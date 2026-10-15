// Ações da venda guiada pelo catálogo (spec 0104, D-5). O roteiro fica no fluxo dos Gatilhos;
// estas ações só fazem o que o motor não sabia: aprovação da equipe, crédito, cliente por
// documento, consultor do cliente e o pedido em variáveis.

import "server-only";
import prisma from "@/lib/prisma";
import { applyTagsByAi } from "@/features/tracking-chat-ai/lib/apply-tags-by-ai";
import { signalLeadAwaitingHuman } from "@/features/tracking-chat-ai/lib/awaiting-human";
import { getLeadCreditStatus } from "@/features/payment/server/entries/lead-credit-status";
import { previewPurchaseStars } from "@/features/star-friends/lib/earn";
import { nerpPublicOrigin } from "@/features/nerp/lib/oauth";
import { loadActiveCatalogOrder } from "@/features/nerp-catalog/lib/order-context";
import { isOrderAwaitingCustomer, minutesUntilReminderHours, sendContactReminder } from "@/features/nerp-catalog/lib/guided-order-contact";
import { approveOrderQuote } from "@/features/nerp-catalog/lib/order-quote-actions";
import { buildOrderPortalUrl, formatBrl } from "@/features/nerp-catalog/utils/format-order";
import type { CatalogOrderCustomer, CatalogOrderItem } from "@/features/nerp-catalog/schemas/order-payload";
import {
  CATALOG_APPROVAL_DECIDED_EVENT,
  applyRoundOutcome,
  loadRoundOutcome,
  openApprovalRound,
} from "@/features/nerp-catalog/lib/approvals/order-approvals";
import { SALES_SECTOR_LABEL, type SalesRound, type SalesSector } from "@/features/nerp-catalog/lib/approvals/approval-rules";
import {
  buildPointsSentence,
  firstNameOf,
  formatDeliveryDate,
  POINTS_TEMPLATE_FALLBACK,
  summarizeItems,
} from "@/features/nerp-catalog/lib/approvals/approval-messages";
import { sendCustomerMessage } from "@/features/nerp-catalog/lib/approvals/approval-delivery";
import { getCustomerWindow } from "@/features/tracking-chat/lib/customer-window";
import { findOrCreateTags } from "../agent-presets/find-or-create-tags";
import { extractDocument, isAffirmativeWithoutName, matchConsultants } from "../catalog-sales-matching";
import { markAwaitingReply } from "./conversation-steps";
import { AWAITING_REPLY_KEY } from "../conversation-steps";
import type { NodeExecutionResult, NodeExecutor } from "../run-workflow";
import { interpolate, type WorkflowContext } from "../workflow-context";

export const SALES_APPROVAL_OUTPUTS = ["approved", "rejected", "timeout"] as const;
export const CHECK_CREDIT_OUTPUTS = ["eligible", "overdue"] as const;
export const FIND_CUSTOMER_OUTPUTS = ["returning", "new", "no_document"] as const;
export const ROUTE_TO_CONSULTANT_OUTPUTS = ["found", "not_found"] as const;
export const CATALOG_ORDER_ACTION_OUTPUTS = ["main", "no_order"] as const;

const DEFAULT_APPROVAL_TIMEOUT_MINUTES = 48 * 60;
const DEFAULT_REPLY_TIMEOUT_MINUTES = 24 * 60;
const MAX_ASK_ATTEMPTS = 2;
/** Sem telefone ou sem WhatsApp no tracking: esperar não adianta. */
const UNREACHABLE_REASONS = new Set(["no_phone", "no_whatsapp_instance"]);
// Sem pergunta configurada a ação lê a mensagem que disparou o fluxo (gatilho por tag) ou a última resposta.
const DEFAULT_SOURCE_TEXT = "{{trigger.leadMessage.text}} {{vars.lastIncomingMessage}}";
const SALES_SECTORS: SalesSector[] = ["COMMERCIAL", "FINANCE", "LOGISTICS", "ACCOUNTING"];

const SALES_TAGS = {
  eligible: { slug: "apto-a-comprar", name: "Apto a comprar", color: "#10b981" },
  overdue: { slug: "inadimplente", name: "Inadimplente", color: "#ef4444" },
  returning: { slug: "cliente-recorrente", name: "Cliente recorrente", color: "#3b82f6" },
  newCustomer: { slug: "cliente-novo", name: "Cliente novo", color: "#a855f7" },
  hasConsultant: { slug: "ja-atendido", name: "Já atendido", color: "#64748b" },
} as const;

type LeadScope = { leadId: string; trackingId: string; organizationId: string };

function readString(record: Record<string, unknown> | undefined, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

async function resolveLeadScope(context: WorkflowContext): Promise<LeadScope | null> {
  const lead = context.lead as Record<string, unknown> | undefined;
  const leadId = readString(lead, "id");
  const trackingId = readString(lead, "trackingId");
  if (!leadId || !trackingId) return null;
  const organizationId =
    readString(context.trigger, "organizationId") ??
    (await prisma.tracking.findUnique({ where: { id: trackingId }, select: { organizationId: true } }))?.organizationId ??
    null;
  return organizationId ? { leadId, trackingId, organizationId } : null;
}

const WINDOW_SAFETY_MARGIN_MINUTES = 60;
const MIN_WINDOW_WAIT_MINUTES = 15;

/**
 * "Dentro da janela do cliente" (pedido do usuário, spec 0104): a espera termina antes de fechar a
 * janela de 24h da última mensagem do cliente, com folga de 1h para o fluxo ainda responder em texto.
 * Janela já fechada: vale o prazo configurado (as mensagens saem por template).
 */
async function resolveTimeoutMinutes(data: Record<string, unknown>, scope: LeadScope | null, fallbackMinutes: number): Promise<number> {
  const configured = typeof data.timeoutMinutes === "number" && data.timeoutMinutes > 0 ? data.timeoutMinutes : fallbackMinutes;
  if (data.timeoutMode !== "customer_window" || !scope) return configured;
  const conversation = await prisma.conversation.findFirst({ where: { leadId: scope.leadId, trackingId: scope.trackingId }, select: { id: true } });
  if (!conversation) return configured;
  const window = await getCustomerWindow(conversation.id);
  if (!window.withinWindow || !window.expiresAt) return configured;
  const remainingMinutes = Math.floor((window.expiresAt.getTime() - Date.now()) / 60_000) - WINDOW_SAFETY_MARGIN_MINUTES;
  return Math.min(configured, Math.max(remainingMinutes, MIN_WINDOW_WAIT_MINUTES));
}

function failed(errorMessage: string): NodeExecutionResult {
  return { output: { error: errorMessage }, status: "FAILED", errorMessage };
}

async function applySalesTag(scope: LeadScope, tag: (typeof SALES_TAGS)[keyof typeof SALES_TAGS]) {
  try {
    const { tagMap } = await findOrCreateTags(prisma, scope.organizationId, [tag]);
    const tagId = tagMap[tag.slug];
    if (tagId) await applyTagsByAi({ leadId: scope.leadId, tagIds: [tagId] });
  } catch (error) {
    console.warn("[workflows/catalog-sales] tag falhou", error instanceof Error ? error.message : "erro");
  }
}

/** Pedido em variáveis para as mensagens do fluxo: `{{vars.pedido.total}}`, `{{vars.pedido.entrega}}`... */
async function buildOrderVars(orderId: string) {
  const order = await prisma.catalogOrder.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      id: true,
      organizationId: true,
      leadId: true,
      nerpSaleNumber: true,
      items: true,
      customer: true,
      total: true,
      publicToken: true,
      deliveryPromiseAt: true,
      pendingDeliveryChangeAt: true,
      deliveryNote: true,
    },
  });
  const total = Number(order.total);
  const points = await previewPurchaseStars(order.organizationId, total).catch(() => null);
  const pointsSentence = buildPointsSentence(points);
  const customerDocument = (order.customer as CatalogOrderCustomer).document;
  const previousPurchases = await prisma.catalogOrder.count({
    where: {
      organizationId: order.organizationId,
      id: { not: order.id },
      status: { in: ["PAID", "IN_LOGISTICS", "DELIVERED"] },
      OR: [{ leadId: order.leadId }, ...(customerDocument ? [{ customer: { path: ["document"], equals: customerDocument } }] : [])],
    },
  });
  return {
    id: order.id,
    numero: String(order.nerpSaleNumber),
    cliente: firstNameOf((order.customer as CatalogOrderCustomer).name),
    itens: summarizeItems(order.items as CatalogOrderItem[]),
    total: formatBrl(total),
    entrega: formatDeliveryDate(order.pendingDeliveryChangeAt ?? order.deliveryPromiseAt),
    prazoMudou: order.pendingDeliveryChangeAt ? "sim" : "nao",
    // No texto some quando não há pontos; o template não aceita variável vazia, por isso a versão própria.
    pontos: pointsSentence ? `${pointsSentence}\n\n` : "",
    pontosTemplate: pointsSentence ?? POINTS_TEMPLATE_FALLBACK,
    link: buildOrderPortalUrl(nerpPublicOrigin(), order.publicToken),
    codigo: order.publicToken,
    observacao: order.deliveryNote ?? "",
    clienteNovo: previousPurchases === 0 ? "sim" : "nao",
  };
}

type ApprovalWaitState = { orderId: string; round: SalesRound; approvalIds: string[]; deadlineAt: string };

function waitingStateOf(nodeId: string, context: WorkflowContext): ApprovalWaitState | null {
  const previous = context.nodeOutputs?.[nodeId] as Partial<ApprovalWaitState> & { isWaitingApproval?: boolean } | undefined;
  if (!previous?.isWaitingApproval || !previous.orderId || !previous.round || !previous.deadlineAt) return null;
  return { orderId: previous.orderId, round: previous.round, approvalIds: previous.approvalIds ?? [], deadlineAt: previous.deadlineAt };
}

// O evento de decisão só é ouvido depois que a espera começa: reconferir a rodada a cada intervalo
// garante que decisões rápidas (dois setores no mesmo segundo) não se percam.
const APPROVAL_RECHECK_MINUTES = 15;

function waitForApproval(state: ApprovalWaitState): NodeExecutionResult {
  const remainingMinutes = Math.ceil((new Date(state.deadlineAt).getTime() - Date.now()) / 60_000);
  return {
    status: "WAITING",
    output: {
      isWaitingApproval: true,
      resumeSameNode: true,
      ...state,
      eventNames: [CATALOG_APPROVAL_DECIDED_EVENT],
      timeoutMinutes: Math.max(1, Math.min(APPROVAL_RECHECK_MINUTES, remainingMinutes)),
    },
  };
}

function readSectors(value: unknown): SalesSector[] {
  return Array.isArray(value) ? value.filter((sector): sector is SalesSector => SALES_SECTORS.includes(sector as SalesSector)) : [];
}

/** Prazo da equipe: o configurado no quadro, contado da abertura (não depende da janela do cliente). */
function approvalDeadlineFrom(data: Record<string, unknown>): string {
  const minutes = typeof data.timeoutMinutes === "number" && data.timeoutMinutes > 0 ? data.timeoutMinutes : DEFAULT_APPROVAL_TIMEOUT_MINUTES;
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

/** Pedido do fluxo: o do gatilho (pagamento) ou o já carregado em `vars.pedido`; senão o mais recente em aberto. */
function loadCatalogOrderForFlow(leadId: string, context: WorkflowContext) {
  const triggerOrderId = readString(context.trigger as Record<string, unknown> | undefined, "catalogOrderId");
  const pedido = (context.vars as Record<string, unknown>).pedido as Record<string, unknown> | undefined;
  const orderId = triggerOrderId ?? readString(pedido, "id") ?? undefined;
  return loadActiveCatalogOrder(leadId, { orderId });
}

// "Pedir aprovação da equipe": abre a rodada e reconfere a cada decisão (ou intervalo) até fechar ou vencer o prazo.
export const salesApprovalExecutor: NodeExecutor = async ({ nodeId, data, context, dryRun }) => {
  const round: SalesRound = data.round === "POST_PAYMENT" ? "POST_PAYMENT" : "PRE_PAYMENT";
  if (dryRun) return { output: { round, simulated: true }, chosenOutput: "approved" };

  const waiting = waitingStateOf(nodeId, context);
  if (waiting) {
    const current = await prisma.catalogOrderApproval.findMany({
      where: { id: { in: waiting.approvalIds } },
      select: { status: true },
    });
    // Valor reenviado abre rodada nova (outro fluxo cuida dela): esta execução termina sem avisar ninguém.
    if (current.length > 0 && current.every((approval) => approval.status === "CANCELED")) {
      return { output: { isWaitingApproval: false, finishedBy: "superseded" }, chosenOutput: "superseded" };
    }

    const outcome = await loadRoundOutcome(waiting.orderId, waiting.round);
    if (outcome.kind === "open") {
      if (Date.now() < new Date(waiting.deadlineAt).getTime()) return waitForApproval(waiting);
      // Prazo vencido: cancela o que ficou pendente para o pedido não ficar travado; o consultor reenvia o valor.
      await prisma.catalogOrderApproval.updateMany({
        where: { id: { in: waiting.approvalIds }, status: "PENDING" },
        data: { status: "CANCELED", awaitingNoteSince: null, awaitingIntent: null },
      });
      if (waiting.round === "PRE_PAYMENT") {
        await prisma.catalogOrder.update({ where: { id: waiting.orderId }, data: { internalApprovalStartedAt: null } });
      }
      const pendentes = outcome.pendingSectors.map((sector) => SALES_SECTOR_LABEL[sector]).join(", ");
      const pedido = await buildOrderVars(waiting.orderId);
      return {
        output: { isWaitingApproval: false, finishedBy: "timeout", vars: { pedido: { ...pedido, motivos: `sem resposta de ${pendentes}` } } },
        chosenOutput: "timeout",
      };
    }
    await applyRoundOutcome(waiting.orderId, waiting.round, outcome);
    const pedido = await buildOrderVars(waiting.orderId);
    if (outcome.kind === "approved") {
      return { output: { isWaitingApproval: false, finishedBy: "approved", vars: { pedido } }, chosenOutput: "approved" };
    }
    const motivos = outcome.reasons.map((reason) => `${SALES_SECTOR_LABEL[reason.sector]}: ${reason.note ?? "recusado"}`).join(" | ");
    return { output: { isWaitingApproval: false, finishedBy: "rejected", vars: { pedido: { ...pedido, motivos } } }, chosenOutput: "rejected" };
  }

  const scope = await resolveLeadScope(context);
  if (!scope) return failed("Fluxo sem lead para pedir aprovação.");
  const order = await loadCatalogOrderForFlow(scope.leadId, context);
  if (!order) return failed("Lead sem pedido do catálogo em aberto.");

  const { sectors } = await openApprovalRound({ orderId: order.id, round, sectors: readSectors(data.sectors) });
  if (sectors.length === 0) {
    await applyRoundOutcome(order.id, round, { kind: "approved", deliveryPromiseAt: null, deliveryNotes: [] });
    return { output: { finishedBy: "no_approvers", vars: { pedido: await buildOrderVars(order.id) } }, chosenOutput: "approved" };
  }
  const opened = await prisma.catalogOrderApproval.findMany({
    where: { orderId: order.id, round, status: "PENDING" },
    select: { id: true },
  });
  return waitForApproval({ orderId: order.id, round, approvalIds: opened.map((approval) => approval.id), deadlineAt: approvalDeadlineFrom(data) });
};

// "Checar crédito do lead".
export const checkCreditExecutor: NodeExecutor = async ({ context, dryRun }) => {
  if (dryRun) return { output: { simulated: true }, chosenOutput: "eligible" };
  const scope = await resolveLeadScope(context);
  if (!scope) return failed("Fluxo sem lead para checar crédito.");
  const credit = await getLeadCreditStatus({ organizationId: scope.organizationId, leadId: scope.leadId });
  await applySalesTag(scope, credit.isEligible ? SALES_TAGS.eligible : SALES_TAGS.overdue);
  return {
    output: { vars: { credito: { apto: credit.isEligible ? "sim" : "nao", contasVencidas: credit.overdueCount, totalVencido: formatBrl(credit.overdueTotalCents / 100) } } },
    chosenOutput: credit.isEligible ? "eligible" : "overdue",
  };
};

type CustomerReply =
  | { kind: "ask"; attempt: number; isRetryOfPending?: boolean }
  | { kind: "answer"; text: string; attempt: number }
  | { kind: "timeout" }
  | { kind: "not_for_me" };

/** Mesmo texto que `leads/create-file.ts` manda no evento quando o atendente anexa um arquivo. */
const AGENT_FILE_EVENT_PREFIX = "[Arquivo adicionado pelo atendente]";

/**
 * Pergunta ao cliente e espera a resposta (mesmo mecanismo do "Pedir aceite", spec 0099):
 * a pergunta fica marcada e o Astro não responde por cima. Sem pergunta, lê o texto configurado.
 */
function readCustomerReply(nodeId: string, data: Record<string, unknown>, context: WorkflowContext): CustomerReply {
  const question = readString(data, "question");
  const previous = context.nodeOutputs?.[nodeId] as { isWaitingCustomer?: boolean; isQuestionPending?: boolean; attempt?: number } | undefined;
  const vars = context.vars as Record<string, unknown>;
  if (previous?.isWaitingCustomer) {
    if (vars.lastWaitTimedOut === true) return { kind: "timeout" };
    // A pergunta não pôde sair (janela fechada): a primeira mensagem do cliente abre a janela e aí perguntamos.
    if (previous.isQuestionPending) return { kind: "ask", attempt: previous.attempt ?? 1, isRetryOfPending: true };
    const text = typeof vars.lastIncomingMessage === "string" ? vars.lastIncomingMessage : "";
    if (text.startsWith(AGENT_FILE_EVENT_PREFIX)) return { kind: "not_for_me" };
    return { kind: "answer", text, attempt: previous.attempt ?? 1 };
  }
  if (question) return { kind: "ask", attempt: 1 };
  return { kind: "answer", text: interpolate(context, readString(data, "text") ?? DEFAULT_SOURCE_TEXT), attempt: MAX_ASK_ATTEMPTS };
}

/** Continua esperando sem perguntar de novo (evento que não é resposta do cliente). */
function keepWaiting(nodeId: string, context: WorkflowContext): NodeExecutionResult {
  return { status: "WAITING", output: { ...(context.nodeOutputs?.[nodeId] as Record<string, unknown>) } };
}

/**
 * Outro passo perguntou depois deste (ex.: o CPF da aprovação do valor enquanto a pergunta do consultor
 * ainda esperava): a resposta é dele. Vale a última pergunta marcada na conversa.
 */
async function isQuestionSuperseded(scope: LeadScope, nodeId: string): Promise<boolean> {
  const recentSent = await prisma.message.findMany({
    where: { conversation: { leadId: scope.leadId, trackingId: scope.trackingId }, fromMe: true },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { metadata: true },
  });
  for (const message of recentSent) {
    const marker = (message.metadata as Record<string, unknown> | null)?.[AWAITING_REPLY_KEY] as { nodeId?: unknown } | undefined;
    if (marker && typeof marker.nodeId === "string") return marker.nodeId !== nodeId;
  }
  return false;
}

async function askCustomer(params: {
  nodeId: string;
  scope: LeadScope;
  text: string;
  attempt: number;
  data: Record<string, unknown>;
  context: WorkflowContext;
  isRetryOfPending?: boolean;
  /** Fora da janela de 24h sai este template; sem ele, a pergunta espera o cliente escrever. */
  template?: { name: string; bodyParameters: string[] };
}): Promise<NodeExecutionResult> {
  const conversation = await prisma.conversation.findFirst({
    where: { leadId: params.scope.leadId, trackingId: params.scope.trackingId },
    select: { id: true },
  });
  if (!conversation) return failed("Lead sem conversa para perguntar.");
  const delivery = await sendCustomerMessage({
    conversationId: conversation.id,
    senderName: "Astro",
    text: interpolate(params.context, params.text),
    // O pedido chega pelo catálogo: sem forçar, a pergunta ficaria só no acompanhamento.
    isWhatsappForced: true,
    // Re-pergunta com a janela ainda fechada não repete a cópia no chat.
    shouldPersistWhenUnsent: !params.isRetryOfPending,
    template: params.template,
  }).catch((error: unknown) => ({ isSent: false as const, reason: error instanceof Error ? error.message : "whatsapp_send_failed" }));
  if (!delivery.isSent && UNREACHABLE_REASONS.has(delivery.reason)) {
    return failed(`Não foi possível perguntar ao cliente (${delivery.reason}).`);
  }
  // Não saiu (janela fechada, template ainda em análise na Meta): espera o cliente escrever e pergunta na hora.
  const isQuestionPending = !delivery.isSent && delivery.reason !== "portal_only";
  // Janela fechada: espera a primeira mensagem do cliente (no prazo configurado) para perguntar de novo.
  const timeoutMinutes = await resolveTimeoutMinutes(params.data, params.scope, DEFAULT_REPLY_TIMEOUT_MINUTES);
  await markAwaitingReply({ leadId: params.scope.leadId, trackingId: params.scope.trackingId, nodeId: params.nodeId, timeoutMinutes });
  return {
    status: "WAITING",
    output: {
      isWaitingCustomer: true,
      isQuestionPending,
      attempt: params.attempt,
      resumeSameNode: true,
      eventNames: ["message-incoming"],
      timeoutMinutes,
      askedAt: new Date().toISOString(),
    },
  };
}

/**
 * O evento da mensagem pode chegar segundos depois dela (o atendimento junta mensagens seguidas antes de
 * avisar), então o texto do evento pode ser de antes da pergunta: "Quero finalizar meu pedido #5" acordava a
 * pergunta do consultor como se fosse "não tenho". A resposta é a última mensagem do cliente DEPOIS da
 * pergunta; sem nenhuma, o evento não é resposta e o passo segue esperando (`null`).
 */
async function readAnswerAfterQuestion(
  scope: LeadScope,
  nodeId: string,
  context: WorkflowContext,
  reply: Extract<CustomerReply, { kind: "answer" }>,
): Promise<Extract<CustomerReply, { kind: "answer" }> | null> {
  const previous = context.nodeOutputs?.[nodeId] as { askedAt?: unknown } | undefined;
  if (typeof previous?.askedAt !== "string") return reply;
  const answer = await prisma.message.findFirst({
    where: {
      conversation: { leadId: scope.leadId, trackingId: scope.trackingId },
      fromMe: false,
      createdAt: { gte: new Date(previous.askedAt) },
    },
    orderBy: { createdAt: "desc" },
    select: { body: true },
  });
  if (!answer) return null;
  return { ...reply, text: answer.body?.trim() || reply.text };
}

// "Buscar cliente por CPF/CNPJ".
export const findCustomerByDocumentExecutor: NodeExecutor = async ({ nodeId, data, context, dryRun }) => {
  if (dryRun) return { output: { simulated: true }, chosenOutput: "new" };
  const scope = await resolveLeadScope(context);
  if (!scope) return failed("Fluxo sem lead para buscar o cliente.");

  const lead = context.lead as Record<string, unknown> | undefined;
  let reply: CustomerReply =
    data.source === "lead" ? { kind: "answer", text: readString(lead, "document") ?? "", attempt: MAX_ASK_ATTEMPTS } : readCustomerReply(nodeId, data, context);
  if (reply.kind === "not_for_me") return keepWaiting(nodeId, context);
  if (reply.kind === "answer" && data.source !== "lead") {
    const answer = await readAnswerAfterQuestion(scope, nodeId, context, reply);
    if (!answer) return keepWaiting(nodeId, context);
    reply = answer;
  }
  if (reply.kind === "ask") {
    return askCustomer({ nodeId, scope, text: readString(data, "question") ?? "", attempt: reply.attempt, isRetryOfPending: reply.isRetryOfPending, data, context });
  }
  const document = reply.kind === "answer" ? extractDocument(reply.text) : null;
  if (!document) {
    if (reply.kind === "answer" && reply.attempt < MAX_ASK_ATTEMPTS && readString(data, "question")) {
      const typedDigits = reply.text.replace(/\D/g, "").length;
      // Número com cara de CPF/CNPJ que não fecha os dígitos: o cliente digitou errado, não é que não leu.
      const retryText =
        typedDigits === 11 || typedDigits === 14
          ? "Hmm, esse número não bateu 🤔 Confere pra mim o CPF ou CNPJ?"
          : "Não peguei o número 😅 Me manda só os números do CPF ou CNPJ?";
      return askCustomer({ nodeId, scope, text: readString(data, "retryQuestion") ?? retryText, attempt: reply.attempt + 1, data, context });
    }
    return { output: { isWaitingCustomer: false, vars: { cliente: { documento: "" } } }, chosenOutput: "no_document" };
  }

  const previousPurchase = await prisma.catalogOrder.findFirst({
    where: {
      organizationId: scope.organizationId,
      status: { in: ["PAID", "IN_LOGISTICS", "DELIVERED"] },
      OR: [{ customer: { path: ["document"], equals: document } }, { lead: { document } }],
    },
    select: { id: true },
  });
  await prisma.lead.update({ where: { id: scope.leadId }, data: { document } });
  const order = await loadCatalogOrderForFlow(scope.leadId, context);
  if (order) {
    await prisma.catalogOrder.update({ where: { id: order.id }, data: { customer: { ...order.customer, document } } });
  }
  const isReturning = !!previousPurchase;
  await applySalesTag(scope, isReturning ? SALES_TAGS.returning : SALES_TAGS.newCustomer);
  return {
    output: { isWaitingCustomer: false, vars: { cliente: { documento: document, recorrente: isReturning ? "sim" : "nao" } } },
    chosenOutput: isReturning ? "returning" : "new",
  };
};

// "Encaminhar para o consultor dele".
export const routeToConsultantExecutor: NodeExecutor = async ({ nodeId, data, context, dryRun }) => {
  const scope = await resolveLeadScope(context);
  if (!scope) return failed("Fluxo sem lead para encaminhar.");
  let reply = readCustomerReply(nodeId, data, context);
  if (reply.kind === "ask") {
    if (dryRun) return { output: { simulated: true }, chosenOutput: "not_found" };
    return askCustomer({
      nodeId,
      scope,
      text: readString(data, "question") ?? "",
      attempt: reply.attempt,
      isRetryOfPending: reply.isRetryOfPending,
      data,
      context,
    });
  }
  if (reply.kind === "not_for_me") return keepWaiting(nodeId, context);
  if (reply.kind === "answer") {
    const answer = await readAnswerAfterQuestion(scope, nodeId, context, reply);
    if (!answer) return keepWaiting(nodeId, context);
    reply = answer;
  }
  // Sem resposta no prazo, ou o cliente já está respondendo outra pergunta: encerra calado (saída sem ligação),
  // para o "já passei pra equipe" não aparecer fora de hora.
  if (reply.kind === "timeout" || (await isQuestionSuperseded(scope, nodeId))) {
    return { output: { isWaitingCustomer: false, vars: { consultor: { nome: "" } } }, chosenOutput: "ended" };
  }

  // Tocou "Tenho sim" (ou escreveu só isso): pergunta o nome uma vez, já dentro da janela.
  if (reply.kind === "answer" && isAffirmativeWithoutName(reply.text) && reply.attempt < MAX_ASK_ATTEMPTS) {
    return askCustomer({ nodeId, scope, text: readString(data, "nameQuestion") ?? "Show! Qual o nome dele?", attempt: reply.attempt + 1, data, context });
  }

  const consultants = await prisma.trackingConsultant.findMany({
    where: { trackingId: scope.trackingId, isActive: true },
    select: { userId: true, user: { select: { name: true } } },
  });
  const matches = matchConsultants(reply.text, consultants.map((consultant) => ({ userId: consultant.userId, name: consultant.user.name ?? "" })));
  if (matches.length !== 1) {
    return {
      output: { isWaitingCustomer: false, vars: { consultor: { nome: "", candidatos: matches.map((match) => match.name).join(", ") } } },
      chosenOutput: "not_found",
    };
  }
  const consultant = matches[0];
  if (dryRun) return { output: { vars: { consultor: { nome: consultant.name } } }, chosenOutput: "found" };

  await prisma.lead.update({ where: { id: scope.leadId }, data: { responsibleId: consultant.userId, assignedAt: new Date(), isActive: false } });
  await applySalesTag(scope, SALES_TAGS.hasConsultant);
  const conversation = await prisma.conversation.findFirst({ where: { leadId: scope.leadId, trackingId: scope.trackingId }, select: { id: true } });
  if (conversation) {
    await signalLeadAwaitingHuman({ organizationId: scope.organizationId, leadId: scope.leadId, conversationId: conversation.id, reason: "client_asked" });
  }
  return { output: { isWaitingCustomer: false, vars: { consultor: { nome: consultant.name } } }, chosenOutput: "found" };
};

type CatalogOrderAction = "load" | "approve_quote" | "approve_delivery_change" | "release" | "await_reply" | "remind_customer";
const CATALOG_ORDER_ACTIONS: CatalogOrderAction[] = ["load", "approve_quote", "approve_delivery_change", "release", "await_reply", "remind_customer"];
const DEFAULT_CONTACT_REMINDER_MINUTES = 30;

/** A mensagem do cliente acorda a espera antes do prazo; aí a tag já saiu e nada é enviado. */
function waitForCustomerContact(orderId: string, timeoutMinutes: number): NodeExecutionResult {
  return {
    status: "WAITING",
    output: { action: "remind_customer", isWaitingReminder: true, orderId, resumeSameNode: true, eventNames: ["message-incoming"], timeoutMinutes },
  };
}

// "Atualizar pedido do catálogo": carrega o pedido em variáveis e registra os aceites do cliente.
export const catalogOrderActionExecutor: NodeExecutor = async ({ nodeId, data, context, dryRun }) => {
  const action = CATALOG_ORDER_ACTIONS.includes(data.action as CatalogOrderAction) ? (data.action as CatalogOrderAction) : "load";
  const scope = await resolveLeadScope(context);
  if (!scope) return failed("Fluxo sem lead.");

  // "Lembrar o cliente de enviar o pedido" (RF-0b): espera só este pedido; se ele ainda não escreveu, um lembrete.
  if (action === "remind_customer") {
    if (dryRun) return { output: { action } };
    const previous = context.nodeOutputs?.[nodeId] as { isWaitingReminder?: boolean; orderId?: string } | undefined;
    if (!previous?.isWaitingReminder || !previous.orderId) {
      const order = await loadCatalogOrderForFlow(scope.leadId, context);
      if (!order) return { output: { action }, chosenOutput: "no_order" };
      const delayMinutes = typeof data.delayMinutes === "number" && data.delayMinutes > 0 ? data.delayMinutes : DEFAULT_CONTACT_REMINDER_MINUTES;
      return waitForCustomerContact(order.id, delayMinutes);
    }
    // Acordou por mensagem do cliente (não pelo prazo): ele já escreveu, nada a lembrar.
    const isTimedOut = (context.vars as Record<string, unknown>).lastWaitTimedOut === true;
    if (!isTimedOut || !(await isOrderAwaitingCustomer(previous.orderId))) {
      return { output: { action, isWaitingReminder: false, reminded: false } };
    }
    const minutesUntilDaytime = minutesUntilReminderHours();
    if (minutesUntilDaytime > 0) return waitForCustomerContact(previous.orderId, minutesUntilDaytime);
    const result = await sendContactReminder(previous.orderId);
    return { output: { action, isWaitingReminder: false, reminded: result.isSent } };
  }

  // "Esperar a resposta do cliente": marca a última mensagem enviada para o Astro não responder por cima.
  if (action === "await_reply") {
    if (dryRun) return { output: { action } };
    const previous = context.nodeOutputs?.[nodeId] as { isWaitingCustomer?: boolean } | undefined;
    if (previous?.isWaitingCustomer) {
      const text = (context.vars as Record<string, unknown>).lastIncomingMessage;
      if (typeof text === "string" && text.startsWith(AGENT_FILE_EVENT_PREFIX)) return keepWaiting(nodeId, context);
      return { output: { action, isWaitingCustomer: false } };
    }
    const timeoutMinutes = await resolveTimeoutMinutes(data, scope, DEFAULT_REPLY_TIMEOUT_MINUTES);
    await markAwaitingReply({ leadId: scope.leadId, trackingId: scope.trackingId, nodeId, timeoutMinutes });
    return {
      status: "WAITING",
      output: { action, isWaitingCustomer: true, resumeSameNode: true, eventNames: ["message-incoming"], timeoutMinutes },
    };
  }

  const order = await loadCatalogOrderForFlow(scope.leadId, context);
  if (!order) return { output: { action }, chosenOutput: "no_order" };
  if (dryRun) return { output: { action, vars: { pedido: await buildOrderVars(order.id) } } };

  if (action === "approve_quote") {
    try {
      await approveOrderQuote(order.id);
    } catch (error) {
      return failed(error instanceof Error ? error.message : "Não foi possível registrar o aceite do valor.");
    }
  }
  if (action === "approve_delivery_change") {
    const current = await prisma.catalogOrder.findUniqueOrThrow({ where: { id: order.id }, select: { pendingDeliveryChangeAt: true } });
    if (current.pendingDeliveryChangeAt) {
      await prisma.catalogOrder.update({
        where: { id: order.id },
        data: { deliveryPromiseAt: current.pendingDeliveryChangeAt, pendingDeliveryChangeAt: null, postPaymentApprovedAt: new Date() },
      });
    }
  }
  if (action === "release") {
    await prisma.catalogOrder.updateMany({ where: { id: order.id, postPaymentApprovedAt: null }, data: { postPaymentApprovedAt: new Date() } });
  }
  return { output: { action, vars: { pedido: await buildOrderVars(order.id) } } };
};
