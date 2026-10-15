import "server-only";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { dispatchAlert } from "@/features/alerts/lib/alert-engine";
import { waIdLookupVariants } from "@/features/tracking-chat/lib/providers/adapters/meta-cloud/normalize-phone";
import { getLeadCreditStatus } from "@/features/payment/server/entries/lead-credit-status";
import type { CatalogOrderCustomer, CatalogOrderItem } from "../../schemas/order-payload";
import { formatBrl } from "../../utils/format-order";
import {
  buildApprovalPayload,
  buildOpenApprovalPayload,
  parseOpenApprovalPayload,
  canDecideApproval,
  isApprovalReminderDue,
  parseApprovalPayload,
  resolveApprovalTemplates,
  summarizeRound,
  SALES_SECTOR_LABEL,
  type ApprovalDecision,
  type RoundOutcome,
  type SalesRound,
  type SalesSector,
} from "./approval-rules";
import { buildApproverSummary, buildPostPaymentSummary, formatDeliveryDate } from "./approval-messages";
import { sendApproverMessage, type QuickButton } from "./approval-delivery";
import { extractDeliveryDate } from "./extract-delivery-date";

// Rodadas de aprovação dos setores (spec 0104). Quem decide a ordem das etapas é o fluxo dos
// Gatilhos (D-5): a ação "Pedir aprovação da equipe" abre a rodada e espera o evento abaixo.

export const CATALOG_APPROVAL_DECIDED_EVENT = "agent-workflow/catalog-approval-decided";

const AWAITING_INTENT = { deliveryDate: "delivery_date", adjust: "adjust", reject: "reject" } as const;
const AWAITING_NOTE_TTL_MS = 30 * 60 * 1000;
type AwaitingIntent = (typeof AWAITING_INTENT)[keyof typeof AWAITING_INTENT];

const PAYMENT_METHOD_LABEL: Record<string, string> = { PIX: "PIX", ASAAS_LINK: "cartão ou boleto" };

export class SalesApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SalesApprovalError";
  }
}

export function toApproverPhone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

export async function hasActiveSalesApprovers(organizationId: string, round?: SalesRound): Promise<boolean> {
  const count = await prisma.salesApprover.count({
    where: { organizationId, isActive: true, optInAt: { not: null }, ...(round ? { rounds: { has: round } } : {}) },
  });
  return count > 0;
}

/** Abre (ou reabre, CB-4) a rodada para os setores com aprovador. Sem aprovador = rodada vazia, já fechada (CB-2). */
export async function openApprovalRound(params: { orderId: string; round: SalesRound; sectors?: SalesSector[] }) {
  const order = await prisma.catalogOrder.findUniqueOrThrow({
    where: { id: params.orderId },
    select: { id: true, organizationId: true },
  });
  const approvers = await prisma.salesApprover.findMany({
    where: {
      organizationId: order.organizationId,
      isActive: true,
      optInAt: { not: null },
      rounds: { has: params.round },
      ...(params.sectors?.length ? { sector: { in: params.sectors } } : {}),
    },
    select: { sector: true },
  });
  const sectors = [...new Set(approvers.map((approver) => approver.sector))];
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.catalogOrderApproval.updateMany({
      where: { orderId: order.id, round: params.round, status: { in: ["PENDING", "ADJUSTED", "APPROVED", "REJECTED"] } },
      data: { status: "CANCELED", awaitingNoteSince: null, awaitingIntent: null },
    });
    if (sectors.length > 0) {
      await tx.catalogOrderApproval.createMany({
        data: sectors.map((sector) => ({ organizationId: order.organizationId, orderId: order.id, round: params.round, sector })),
      });
    }
    await tx.catalogOrder.update({
      where: { id: order.id },
      data:
        params.round === "PRE_PAYMENT"
          ? { internalApprovalStartedAt: sectors.length > 0 ? now : null, internalApprovedAt: sectors.length > 0 ? null : now }
          : { postPaymentApprovedAt: sectors.length > 0 ? null : now, pendingDeliveryChangeAt: null },
    });
  });

  if (sectors.length > 0) await notifyPendingApprovals(order.id, params.round);
  return { sectors };
}

async function loadOrderForMessages(orderId: string) {
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
      paymentMethod: true,
      deliveryPromiseAt: true,
      publicToken: true,
    },
  });
  const integration = await prisma.nerpCatalogIntegration.findUnique({
    where: { organizationId: order.organizationId },
    select: { ordersTrackingId: true, approvalTemplates: true },
  });
  if (!integration) throw new SalesApprovalError("Catálogo online não configurado nesta empresa.");
  return { order, integration, templates: resolveApprovalTemplates(integration.approvalTemplates) };
}

async function describeSituation(organizationId: string, leadId: string): Promise<string> {
  const credit = await getLeadCreditStatus({ organizationId, leadId }).catch(() => null);
  if (!credit) return "crédito não consultado";
  return credit.isEligible
    ? "Apto a comprar"
    : `Inadimplente: ${credit.overdueCount} conta(s) vencida(s), ${formatBrl(credit.overdueTotalCents / 100)}`;
}

function decisionButtons(approvalId: string, round: SalesRound): QuickButton[] {
  return round === "PRE_PAYMENT"
    ? [
        { id: buildApprovalPayload(approvalId, "approve"), title: "Aprovar" },
        { id: buildApprovalPayload(approvalId, "reject"), title: "Recusar" },
        { id: buildApprovalPayload(approvalId, "adjust"), title: "Ajustar" },
      ]
    : [
        { id: buildApprovalPayload(approvalId, "approve"), title: "Confirmar" },
        { id: buildApprovalPayload(approvalId, "adjust"), title: "Ajustar" },
      ];
}

/** Envia o resumo a cada aprovador das aprovações pendentes ainda não avisadas (ou com lembrete vencido). */
export async function notifyPendingApprovals(
  orderId: string,
  round: SalesRound,
  options: { isReminder?: boolean; resendApprovalIds?: string[] } = {},
) {
  const { order, integration, templates } = await loadOrderForMessages(orderId);
  const approvals = await prisma.catalogOrderApproval.findMany({
    where: {
      orderId,
      round,
      status: "PENDING",
      ...(options.resendApprovalIds ? { id: { in: options.resendApprovalIds } } : options.isReminder ? {} : { notifiedAt: null }),
    },
    select: { id: true, sector: true, notifiedAt: true },
  });
  if (approvals.length === 0) return { sent: 0 };

  const customer = order.customer as CatalogOrderCustomer;
  const items = order.items as CatalogOrderItem[];
  const situation = round === "PRE_PAYMENT" ? await describeSituation(order.organizationId, order.leadId) : "";
  let sent = 0;

  for (const approval of approvals) {
    let sentForApproval = 0;
    const approvers = await prisma.salesApprover.findMany({
      where: { organizationId: order.organizationId, sector: approval.sector, isActive: true, optInAt: { not: null }, rounds: { has: round } },
      select: { phoneE164: true, lastInboundAt: true },
    });
    const summary =
      round === "PRE_PAYMENT"
        ? buildApproverSummary({ saleNumber: order.nerpSaleNumber, sector: approval.sector, customerName: customer.name, items, total: Number(order.total), situation })
        : buildPostPaymentSummary({
            saleNumber: order.nerpSaleNumber,
            sector: approval.sector,
            customerName: customer.name,
            paidAmount: Number(order.total),
            paymentMethodLabel: PAYMENT_METHOD_LABEL[order.paymentMethod ?? ""] ?? "Asaas",
            deliveryPromiseAt: order.deliveryPromiseAt,
          });
    const buttons = decisionButtons(approval.id, round);
    const templateName = options.isReminder ? templates.reminder : round === "PRE_PAYMENT" ? templates.approval : templates.postPaymentCheck;
    const reminderSince = approval.notifiedAt ? formatDeliveryDate(approval.notifiedAt) : "agora";
    const template = options.isReminder
      ? { name: templateName, bodyParameters: [String(order.nerpSaleNumber), SALES_SECTOR_LABEL[approval.sector], reminderSince], quickReplyPayloads: [buildOpenApprovalPayload(approval.id)] }
      : { name: templateName, bodyParameters: summary.templateParameters, quickReplyPayloads: buttons.map((button) => button.id) };

    for (const approver of approvers) {
      const result = await sendApproverMessage({
        trackingId: integration.ordersTrackingId,
        phoneE164: approver.phoneE164,
        lastInboundAt: approver.lastInboundAt,
        text: summary.text,
        buttons,
        template,
      });
      if (result.isSent) sentForApproval += 1;
      else console.warn(`[nerp-catalog/approvals] aviso ao setor ${approval.sector} falhou`, result.reason);
    }
    sent += sentForApproval;
    // Sem nenhuma entrega fica sem `notifiedAt`: a próxima mensagem do aprovador reenvia (janela aberta).
    if (sentForApproval === 0 && !options.isReminder) continue;
    await prisma.catalogOrderApproval.update({
      where: { id: approval.id },
      data: options.isReminder ? { lastReminderAt: new Date() } : { notifiedAt: new Date() },
    });
  }
  return { sent };
}

export async function loadRoundOutcome(orderId: string, round: SalesRound): Promise<RoundOutcome> {
  const approvals = await prisma.catalogOrderApproval.findMany({
    where: { orderId, round },
    select: { sector: true, status: true, note: true, proposedDeliveryAt: true },
  });
  return summarizeRound(approvals);
}

/** Grava o resultado da rodada fechada no pedido. Chamado pela ação do fluxo quando ela retoma. */
export async function applyRoundOutcome(orderId: string, round: SalesRound, outcome: RoundOutcome) {
  if (outcome.kind !== "approved") return;
  const order = await prisma.catalogOrder.findUniqueOrThrow({ where: { id: orderId }, select: { deliveryPromiseAt: true } });
  if (round === "PRE_PAYMENT") {
    await prisma.catalogOrder.update({
      where: { id: orderId },
      data: { internalApprovedAt: new Date(), deliveryPromiseAt: outcome.deliveryPromiseAt ?? order.deliveryPromiseAt, deliveryNote: outcome.deliveryNotes.join(" | ") || null },
    });
    return;
  }
  const isDeliveryChanged =
    !!outcome.deliveryPromiseAt && (!order.deliveryPromiseAt || outcome.deliveryPromiseAt.getTime() !== order.deliveryPromiseAt.getTime());
  await prisma.catalogOrder.update({
    where: { id: orderId },
    data: isDeliveryChanged ? { pendingDeliveryChangeAt: outcome.deliveryPromiseAt } : { postPaymentApprovedAt: new Date() },
  });
}

async function emitDecision(approvalId: string) {
  const approval = await prisma.catalogOrderApproval.findUniqueOrThrow({
    where: { id: approvalId },
    select: { orderId: true, round: true, order: { select: { leadId: true, organizationId: true } } },
  });
  await inngest.send({
    name: CATALOG_APPROVAL_DECIDED_EVENT,
    data: { leadId: approval.order.leadId, orderId: approval.orderId, round: approval.round, approvalId },
  });
}

/** Decisão vinda da tela do Órbita (RF-10). O setor do usuário vem do cadastro de aprovadores. */
export async function decideApprovalFromPanel(params: {
  organizationId: string;
  userId: string;
  approvalId: string;
  decision: ApprovalDecision;
  note?: string;
  proposedDeliveryAt?: Date | null;
}) {
  const approval = await prisma.catalogOrderApproval.findFirst({
    where: { id: params.approvalId, organizationId: params.organizationId },
    select: { id: true, organizationId: true, sector: true, round: true, status: true },
  });
  if (!approval) throw new SalesApprovalError("Aprovação não encontrada.");
  const approver = await prisma.salesApprover.findFirst({
    where: { organizationId: params.organizationId, userId: params.userId, sector: approval.sector },
    select: { organizationId: true, sector: true, rounds: true, isActive: true },
  });
  if (!approver || !canDecideApproval(approver, approval)) {
    throw new SalesApprovalError(`Só quem aprova pelo setor ${SALES_SECTOR_LABEL[approval.sector]} pode decidir.`);
  }
  const note = params.note?.trim() || null;
  const status = params.decision === "approve" ? "APPROVED" : params.decision === "reject" ? "REJECTED" : "ADJUSTED";
  if (params.decision === "adjust" && !note && !params.proposedDeliveryAt) {
    throw new SalesApprovalError("Escreva o ajuste ou informe o novo prazo.");
  }
  const decided = await prisma.catalogOrderApproval.updateMany({
    where: { id: approval.id, status: "PENDING" },
    data: {
      status,
      note,
      proposedDeliveryAt: params.proposedDeliveryAt ?? null,
      decidedById: params.userId,
      decidedAt: new Date(),
      awaitingNoteSince: null,
      awaitingIntent: null,
    },
  });
  if (decided.count === 0) throw new SalesApprovalError("Esta aprovação já foi decidida.");
  await emitDecision(approval.id);
}

type ApproverInbound = {
  organizationId: string;
  trackingId: string;
  fromPhone: string;
  replyId?: string | null;
  text?: string | null;
};

async function replyToApprover(trackingId: string, approver: { phoneE164: string }, text: string) {
  await sendApproverMessage({
    trackingId,
    phoneE164: approver.phoneE164,
    lastInboundAt: new Date(),
    text,
  });
}

/**
 * Resposta de aprovador no número oficial (RF-9b). Só desvia a mensagem quando o remetente é aprovador
 * ativo da org E tem aprovação pendente; caso contrário devolve `false` e a mensagem segue como lead (CB-1b).
 */
export async function tryHandleApproverInbound(inbound: ApproverInbound): Promise<boolean> {
  const approvers = await prisma.salesApprover.findMany({
    where: { organizationId: inbound.organizationId, isActive: true, phoneE164: { in: waIdLookupVariants(inbound.fromPhone.replace(/\D/g, "")) } },
    select: { id: true, userId: true, organizationId: true, sector: true, rounds: true, isActive: true, phoneE164: true },
  });
  if (approvers.length === 0) return false;
  // Qualquer mensagem do aprovador abre a janela de 24h dele, mesmo sem pedido pendente ("oi" antes da rodada).
  await prisma.salesApprover.updateMany({ where: { id: { in: approvers.map((approver) => approver.id) } }, data: { lastInboundAt: new Date() } });

  const sectors = approvers.map((approver) => approver.sector);
  const openApprovals = await prisma.catalogOrderApproval.findMany({
    where: { organizationId: inbound.organizationId, sector: { in: sectors }, status: "PENDING" },
    select: {
      id: true,
      orderId: true,
      organizationId: true,
      sector: true,
      round: true,
      status: true,
      notifiedAt: true,
      awaitingNoteSince: true,
      awaitingIntent: true,
      order: { select: { nerpSaleNumber: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  // Pedido de texto vence em 30 min; prazo/ajuste (ainda pendentes) vêm antes do motivo de uma recusa já feita.
  const awaitingNotes = await prisma.catalogOrderApproval.findMany({
    where: { organizationId: inbound.organizationId, sector: { in: sectors }, awaitingNoteSince: { gte: new Date(Date.now() - AWAITING_NOTE_TTL_MS) } },
    select: { id: true, organizationId: true, sector: true, round: true, status: true, awaitingIntent: true },
    orderBy: { awaitingNoteSince: "desc" },
  });
  const awaitingNote = awaitingNotes.find((approval) => approval.status === "PENDING") ?? awaitingNotes[0];
  if (openApprovals.length === 0 && !awaitingNote) return false;

  const contactApprover = approvers[0];

  const openedId = parseOpenApprovalPayload(inbound.replyId);
  if (openedId) {
    const approval = openApprovals.find((candidate) => candidate.id === openedId);
    if (!approval) {
      await replyToApprover(inbound.trackingId, contactApprover, "Esse pedido já foi decidido. Nada pendente.");
      return true;
    }
    await notifyPendingApprovals(approval.orderId, approval.round, { resendApprovalIds: [approval.id] });
    return true;
  }

  const parsed = parseApprovalPayload(inbound.replyId);
  if (parsed) {
    const approval = openApprovals.find((candidate) => candidate.id === parsed.approvalId);
    const approver = approval ? approvers.find((candidate) => canDecideApproval(candidate, approval)) : undefined;
    if (!approval || !approver) {
      await replyToApprover(inbound.trackingId, contactApprover, "Esse pedido já foi decidido ou não é do seu setor. Nada foi alterado.");
      return true;
    }
    await handleButtonDecision({ approval, approver, decision: parsed.decision, trackingId: inbound.trackingId, saleNumber: approval.order.nerpSaleNumber });
    return true;
  }

  const text = inbound.text?.trim();
  if (awaitingNote && text) {
    await completeAwaitingNote({ approvalId: awaitingNote.id, intent: awaitingNote.awaitingIntent as AwaitingIntent | null, text, approvers, trackingId: inbound.trackingId, organizationId: inbound.organizationId });
    return true;
  }

  // Aviso que não chegou (janela fechada, template em análise): a mensagem do aprovador abriu a janela, reenvia agora.
  const undelivered = [...new Map(openApprovals.filter((approval) => !approval.notifiedAt).map((approval) => [`${approval.orderId}:${approval.round}`, approval])).values()];
  if (undelivered.length > 0) {
    for (const approval of undelivered) await notifyPendingApprovals(approval.orderId, approval.round);
    return true;
  }

  // Texto solto com pedidos pendentes (CB-1): não decide nada, só orienta.
  const numbers = [...new Set(openApprovals.map((approval) => `#${approval.order.nerpSaleNumber}`))].join(", ");
  await replyToApprover(inbound.trackingId, contactApprover, `Pedidos aguardando sua decisão: ${numbers}. Use os botões da mensagem de cada pedido para decidir.`);
  return true;
}

async function handleButtonDecision(params: {
  approval: { id: string; sector: SalesSector; round: SalesRound };
  approver: { userId: string; phoneE164: string };
  decision: ApprovalDecision;
  trackingId: string;
  saleNumber: number;
}) {
  const { approval, approver, decision } = params;
  // Com a mesma pessoa em vários setores, toda resposta diz de qual pedido e setor é.
  const reference = `#${params.saleNumber} · ${SALES_SECTOR_LABEL[approval.sector]}`;
  const needsDeliveryDate = decision === "approve" && approval.sector === "LOGISTICS" && approval.round === "PRE_PAYMENT";
  if (needsDeliveryDate || decision === "adjust") {
    await prisma.catalogOrderApproval.update({
      where: { id: approval.id },
      data: { awaitingNoteSince: new Date(), awaitingIntent: needsDeliveryDate ? AWAITING_INTENT.deliveryDate : AWAITING_INTENT.adjust },
    });
    await replyToApprover(
      params.trackingId,
      approver,
      needsDeliveryDate
        ? `${reference}: qual a previsão de entrega? (ex.: amanhã 11h)`
        : `${reference}: escreva o ajuste. Se for de prazo, diga a nova data (ex.: sexta às 11h).`,
    );
    return;
  }
  const decided = await prisma.catalogOrderApproval.updateMany({
    where: { id: approval.id, status: "PENDING" },
    data: {
      status: decision === "approve" ? "APPROVED" : "REJECTED",
      decidedById: approver.userId,
      decidedAt: new Date(),
      ...(decision === "reject" ? { awaitingNoteSince: new Date(), awaitingIntent: AWAITING_INTENT.reject } : {}),
    },
  });
  if (decided.count === 0) return;
  await replyToApprover(
    params.trackingId,
    approver,
    decision === "approve" ? `${reference}: aprovado ✅ Obrigado!` : `${reference}: recusado. Se quiser, escreva o motivo para o consultor.`,
  );
  await emitDecision(approval.id);
}

async function completeAwaitingNote(params: {
  approvalId: string;
  intent: AwaitingIntent | null;
  text: string;
  approvers: Array<{ userId: string; phoneE164: string; sector: SalesSector }>;
  trackingId: string;
  organizationId: string;
}) {
  const approval = await prisma.catalogOrderApproval.findUniqueOrThrow({
    where: { id: params.approvalId },
    select: { id: true, sector: true, status: true, order: { select: { nerpSaleNumber: true } } },
  });
  const approver = params.approvers.find((candidate) => candidate.sector === approval.sector) ?? params.approvers[0];
  const reference = `#${approval.order.nerpSaleNumber} · ${SALES_SECTOR_LABEL[approval.sector]}`;
  const note = params.text.slice(0, 500);

  if (params.intent === AWAITING_INTENT.reject) {
    await prisma.catalogOrderApproval.update({ where: { id: approval.id }, data: { note, awaitingNoteSince: null, awaitingIntent: null } });
    await replyToApprover(params.trackingId, approver, `${reference}: motivo registrado. O consultor vai ver.`);
    await emitDecision(approval.id);
    return;
  }

  const deliveryAt = await extractDeliveryDate({ organizationId: params.organizationId, text: note });
  if (params.intent === AWAITING_INTENT.deliveryDate && !deliveryAt) {
    await replyToApprover(params.trackingId, approver, `${reference}: não entendi a data. Pode mandar de novo? (ex.: quinta às 11h)`);
    return;
  }
  const decided = await prisma.catalogOrderApproval.updateMany({
    where: { id: approval.id, status: "PENDING" },
    data: {
      status: params.intent === AWAITING_INTENT.deliveryDate ? "APPROVED" : "ADJUSTED",
      note,
      proposedDeliveryAt: deliveryAt,
      decidedById: approver.userId,
      decidedAt: new Date(),
      awaitingNoteSince: null,
      awaitingIntent: null,
    },
  });
  if (decided.count === 0) return;
  await replyToApprover(
    params.trackingId,
    approver,
    deliveryAt ? `${reference}: entrega ${formatDeliveryDate(deliveryAt)} ✅` : `${reference}: ajuste registrado. O pedido volta para o consultor.`,
  );
  await emitDecision(approval.id);
}

/** Lembrete de aprovações paradas (CB-3). Rodado pelo cron. */
export async function remindStalledApprovals(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", weekday: "short", hour12: false }).formatToParts(now);
  const localHour = Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24;
  const weekdayName = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const localWeekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayName);

  const pending = await prisma.catalogOrderApproval.findMany({
    where: { status: "PENDING", notifiedAt: { not: null } },
    select: { orderId: true, round: true, notifiedAt: true, lastReminderAt: true, order: { select: { leadId: true, organizationId: true, nerpSaleNumber: true, lead: { select: { responsibleId: true } } } } },
  });
  const dueRounds = new Map<string, { orderId: string; round: SalesRound }>();
  for (const approval of pending) {
    const lastSentAt = approval.lastReminderAt ?? approval.notifiedAt;
    if (lastSentAt && isApprovalReminderDue({ lastSentAt, now, localHour, localWeekday })) {
      dueRounds.set(`${approval.orderId}:${approval.round}`, { orderId: approval.orderId, round: approval.round });
    }
  }
  for (const { orderId, round } of dueRounds.values()) {
    await notifyPendingApprovals(orderId, round, { isReminder: true }).catch((error) =>
      console.error("[nerp-catalog/approvals] lembrete falhou", error),
    );
    const order = pending.find((approval) => approval.orderId === orderId)?.order;
    if (order) {
      await dispatchAlert(
        "catalog.approval.stalled",
        { orderId, round },
        {
          bypassRules: {
            title: `Pedido #${order.nerpSaleNumber} parado na aprovação`,
            body: "Algum setor ainda não decidiu. Você pode conferir na aba Pedido do chat.",
            severity: "warning",
            audience: order.lead.responsibleId ? { kind: "user", userIds: [order.lead.responsibleId] } : { kind: "org_admins" },
            actionUrl: "/tracking-chat",
            orgId: order.organizationId,
            createdBy: "SYSTEM",
          },
        },
      ).catch(() => undefined);
    }
  }
  const resent = await resendDecisionsForClosedRounds(now);
  return { reminded: dueRounds.size, resent };
}

const RESEND_DECISION_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * Rede de segurança: o fluxo só ouve decisões depois de voltar a esperar. Duas decisões quase juntas
 * podem deixar a rodada fechada sem o fluxo saber; reenviar o evento faz a ação conferir de novo.
 */
async function resendDecisionsForClosedRounds(now: Date): Promise<number> {
  const recentlyDecided = await prisma.catalogOrderApproval.findMany({
    where: { decidedAt: { gte: new Date(now.getTime() - RESEND_DECISION_WINDOW_MS) }, status: { not: "CANCELED" } },
    select: { id: true, orderId: true, round: true },
    orderBy: { decidedAt: "desc" },
  });
  const rounds = new Map<string, { approvalId: string; orderId: string; round: SalesRound }>();
  for (const approval of recentlyDecided) {
    const key = `${approval.orderId}:${approval.round}`;
    if (!rounds.has(key)) rounds.set(key, { approvalId: approval.id, orderId: approval.orderId, round: approval.round });
  }
  let resent = 0;
  for (const { approvalId, orderId, round } of rounds.values()) {
    const order = await prisma.catalogOrder.findUnique({
      where: { id: orderId },
      select: { internalApprovedAt: true, postPaymentApprovedAt: true, pendingDeliveryChangeAt: true },
    });
    const isFinalized = round === "PRE_PAYMENT" ? !!order?.internalApprovedAt : !!order?.postPaymentApprovedAt || !!order?.pendingDeliveryChangeAt;
    if (!order || isFinalized) continue;
    const outcome = await loadRoundOutcome(orderId, round);
    if (outcome.kind !== "approved") continue;
    await emitDecision(approvalId);
    resent += 1;
  }
  return resent;
}
