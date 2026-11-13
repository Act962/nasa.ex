/**
 * Helpers pra disparar triggers do Modo Agente IA a partir de outros pontos
 * do sistema (webhooks, Inngest functions, schedulers).
 *
 * Quem chama:
 *   - `dispatchMessageIncoming`  ← webhook WhatsApp (chat/webhook/route.ts)
 *                                  ao receber mensagem inbound do lead.
 *   - `dispatchPaymentReceived`  ← webhook Stripe + Asaas após confirmação.
 *   - `broadcastComplianceItemDue` ← cron `detect-compliance-due` (aba Contábil).
 *
 * Mensagem recebida e pagamento: a busca dos fluxos com o gatilho roda aqui,
 * direto, e só vira execução no Inngest quando existe fluxo (antes era uma
 * função a cada mensagem que quase sempre achava zero). O evento continua
 * sendo publicado porque acorda os fluxos parados em WAIT_FOR_EVENT, e evento
 * sem função não conta execução.
 *
 * Best-effort: erros são logados mas NUNCA quebram o caller — o webhook
 * principal não pode falhar por causa do agente.
 */
import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";

type AgentTriggerType = "PAYMENT_RECEIVED" | "MESSAGE_INCOMING";

async function dispatchToMatchingWorkflows(params: {
  triggerType: AgentTriggerType;
  triggerPayload: Record<string, unknown>;
  organizationId: string;
  trackingId?: string | null;
  leadId?: string | null;
}) {
  const { triggerType, triggerPayload, organizationId, trackingId, leadId } = params;

  const workflows = await prisma.workflow.findMany({
    where: {
      agentMode: true,
      isActive: true,
      tracking: { organizationId },
      ...(trackingId ? { OR: [{ trackingId }, { trackingId: null }] } : {}),
      nodes: { some: { type: triggerType } },
    },
    select: { id: true },
  });
  if (workflows.length === 0) return;

  // Via evento `workflow/execute.workflow` (e não `runWorkflow` direto) para o
  // fluxo rodar dentro de `executeWorkflow`, que sabe suspender e retomar WAITs.
  const { sendWorkflowExecutions } = await import("@/inngest/utils");
  await sendWorkflowExecutions(
    workflows.map((workflow) => ({
      workflowId: workflow.id,
      triggerType,
      leadId: leadId ?? null,
      initialData: { ...triggerPayload, organizationId, trackingId },
    })),
  );
}

interface DispatchMessageIncomingArgs {
  leadId: string;
  organizationId: string;
  trackingId: string;
  messageText: string;
  messageId?: string;
  /**
   * Quando o lead manda mídia (foto/áudio/PDF), o webhook do WhatsApp já
   * upload pra R2 e tem a key. O preset "comprovante-pagamento" usa
   * AI_VISION/READ_PDF com `{{vars.lastEvent.mediaUrl}}` pra ler o
   * arquivo. Sem isso, workflow não sabe diferenciar texto de mídia.
   */
  mediaUrl?: string;
  /** Tipo da mídia (image / document / audio / video). Pro AI_DECISION rotear. */
  mediaType?: "image" | "document" | "audio" | "video";
  /** MIME type completo (image/jpeg, application/pdf, etc) — pra READ_PDF/AI_VISION decidirem se conseguem processar. */
  mimetype?: string;
  /** Nome original do arquivo (só pra DocumentMessage — boleto.pdf, comprovante.jpg, etc). */
  fileName?: string;
  /** Id da opção quando a mensagem é o clique num botão ou item de lista (spec 0090, seção F). */
  interactiveReplyId?: string;
}

export async function dispatchMessageIncoming(args: DispatchMessageIncomingArgs) {
  try {
    await inngest.send({
      name: "agent-workflow/message-incoming",
      // Id da mensagem como id do evento: webhook repetido não acorda o fluxo duas vezes (spec 0139, D-13).
      ...(args.messageId ? { id: `message-incoming:${args.messageId}` } : {}),
      data: {
        leadId: args.leadId,
        organizationId: args.organizationId,
        trackingId: args.trackingId,
        messageText: args.messageText,
        messageId: args.messageId,
        ...(args.mediaUrl ? { mediaUrl: args.mediaUrl } : {}),
        ...(args.mediaType ? { mediaType: args.mediaType } : {}),
        ...(args.mimetype ? { mimetype: args.mimetype } : {}),
        ...(args.fileName ? { fileName: args.fileName } : {}),
        ...(args.interactiveReplyId ? { interactiveReplyId: args.interactiveReplyId } : {}),
      },
    });
  } catch (err) {
    // Não derruba o webhook — agente é best-effort.
    console.error("[agent-trigger:message-incoming] dispatch failed", err);
  }

  try {
    // Lead dentro de um Fluxo de Atendimento: a mensagem é do fluxo, nenhum outro gatilho responde (spec 0139, RF-6).
    const attendanceLock = await prisma.workflowRun.findUnique({ where: { attendanceLeadId: args.leadId }, select: { id: true } });
    if (attendanceLock) return;
    await dispatchToMatchingWorkflows({
      triggerType: "MESSAGE_INCOMING",
      triggerPayload: { messageText: args.messageText, messageId: args.messageId },
      organizationId: args.organizationId,
      trackingId: args.trackingId,
      leadId: args.leadId,
    });
  } catch (error) {
    console.error("[agent-trigger:message-incoming] workflow lookup failed", error);
  }
}

interface DispatchPaymentReceivedArgs {
  provider: "STRIPE" | "ASAAS" | string;
  externalId: string;
  organizationId: string;
  trackingId?: string | null;
  leadId?: string | null;
  amount?: number;
  /**
   * Dados extras que ficam disponíveis no contexto do workflow via
   * `context.trigger.<campo>` ou `{{trigger.X}}` na interpolação. Usado
   * principalmente pra NASA Route — o purchase-side-effects passa
   * `courseTitle`, `planName`, `creatorName`, `coursePlayerUrl` pra que
   * o SEND_EMAIL/SEND_MESSAGE possam preencher o template direto, sem
   * precisar de query adicional no executor.
   */
  extra?: Record<string, unknown>;
}

export async function dispatchPaymentReceived(args: DispatchPaymentReceivedArgs) {
  try {
    await inngest.send({
      name: "agent-workflow/payment-received",
      data: {
        provider: args.provider,
        externalId: args.externalId,
        organizationId: args.organizationId,
        trackingId: args.trackingId ?? null,
        leadId: args.leadId ?? null,
        amount: args.amount,
        ...(args.extra ?? {}),
      },
    });
  } catch (err) {
    console.error("[agent-trigger:payment-received] dispatch failed", err);
  }

  try {
    await dispatchToMatchingWorkflows({
      triggerType: "PAYMENT_RECEIVED",
      triggerPayload: { provider: args.provider, externalId: args.externalId, amount: args.amount, ...(args.extra ?? {}) },
      organizationId: args.organizationId,
      trackingId: args.trackingId ?? null,
      leadId: args.leadId ?? null,
    });
  } catch (error) {
    console.error("[agent-trigger:payment-received] workflow lookup failed", error);
  }
}

export const COMPLIANCE_ITEM_KINDS = ["OBLIGATION", "DOCUMENT", "ASSESSMENT", "INVOICE_MONTH"] as const;
export type ComplianceItemKind = (typeof COMPLIANCE_ITEM_KINDS)[number];

export interface ComplianceItemDueArgs {
  organizationId: string;
  itemKind: ComplianceItemKind;
  code: string;
  label: string;
  /** AAAA-MM-DD. */
  dueDate: string;
  /** Dias até o vencimento; negativo = já vencido há N dias. */
  daysBefore: number;
  amountCents?: number | null;
  /** Mesmo `entityKey` do aviso — o gatilho não dispara duas vezes o mesmo item. */
  entityKey: string;
}

/**
 * Prazo fiscal, documento ou apuração pedindo atenção (spec 0051, RF-16).
 * Quem chama: `features/alerts/lib/detectors/compliance-due.ts`.
 */
export async function broadcastComplianceItemDue(args: ComplianceItemDueArgs) {
  try {
    await inngest.send({
      name: "agent-workflow/compliance-item-due",
      // Id do evento = dedupe nativo do Inngest (24h) para o mesmo item.
      id: `compliance-item-due:${args.entityKey}`,
      data: {
        organizationId: args.organizationId,
        itemKind: args.itemKind,
        code: args.code,
        label: args.label,
        dueDate: args.dueDate,
        daysBefore: args.daysBefore,
        amountCents: args.amountCents ?? null,
        entityKey: args.entityKey,
      },
    });
  } catch (error) {
    console.error("[agent-trigger:compliance-item-due] dispatch failed", error);
  }
}
