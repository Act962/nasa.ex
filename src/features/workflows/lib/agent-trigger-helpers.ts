/**
 * Helpers pra disparar triggers do Modo Agente IA a partir de outros pontos
 * do sistema (webhooks, Inngest functions, schedulers).
 *
 * Quem chama:
 *   - `dispatchMessageIncoming`  ← webhook WhatsApp (chat/webhook/route.ts)
 *                                  ao receber mensagem inbound do lead.
 *   - `dispatchPaymentReceived`  ← webhook Stripe + Asaas após confirmação.
 *
 * Resultado: publica evento Inngest correspondente. As funções
 * `agent-workflow-triggers.ts` consomem e disparam `runWorkflow` em todos
 * os workflows ATIVOS da org com `agentMode=true` que têm o trigger node.
 *
 * Best-effort: erros são logados mas NUNCA quebram o caller — o webhook
 * principal não pode falhar por causa do agente.
 */
import { inngest } from "@/inngest/client";

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
}

export async function dispatchMessageIncoming(args: DispatchMessageIncomingArgs) {
  try {
    await inngest.send({
      name: "agent-workflow/message-incoming",
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
      },
    });
  } catch (err) {
    // Não derruba o webhook — agente é best-effort.
    console.error("[agent-trigger:message-incoming] dispatch failed", err);
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
}
