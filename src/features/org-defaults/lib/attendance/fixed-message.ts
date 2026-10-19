import "server-only";
import prisma from "@/lib/prisma";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers";
import {
  isFreeFormWindowOpen,
  toLegacyUazapiMessageId,
} from "@/features/tracking-chat/lib/providers/automated-outbound";
import { persistOutboundMessage } from "@/features/tracking-chat-ai/lib/persist";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { applyVariables, buildLeadVariables } from "@/features/tracking-executions/lib/interpolate-message";

// Mensagem fixa do atendimento, sem IA (spec 0113, RF-8 e RF-11): "já respondemos" e "assim que um
// consultor desocupar". Marcada no metadata para não contar como troca de verdade nem entrar no resumo.

export type FixedMessageKind = "attendance_holding" | "attendance_handoff";

export type FixedMessageResult =
  | { isSent: true; messageId: string | null }
  | { isSent: false; reason: "lead_not_found" | "window_closed" | "no_provider" | "no_balance" | "empty_text" };

export async function sendAttendanceFixedMessage(params: {
  organizationId: string;
  trackingId: string;
  leadId: string;
  conversationId: string;
  text: string;
  kind: FixedMessageKind;
  senderName: string;
}): Promise<FixedMessageResult> {
  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    include: {
      status: { select: { name: true } },
      tracking: { select: { name: true } },
      responsible: { select: { name: true } },
    },
  });
  if (!lead?.phone) return { isSent: false, reason: "lead_not_found" };

  // Lead sem nome: "Opa, {{primeiro_nome}}, já…" vira "Opa, já…", sem vírgula sobrando.
  const body = applyVariables(params.text, buildLeadVariables(lead))
    .replace(/,\s*,/g, ",")
    .replace(/^\s*,\s*/, "")
    .trim();
  if (!body) return { isSent: false, reason: "empty_text" };

  const resolved = await resolveOutboundProvider(params.trackingId).catch(() => null);
  if (!resolved) return { isSent: false, reason: "no_provider" };
  if (!(await isFreeFormWindowOpen(resolved, params.conversationId))) return { isSent: false, reason: "window_closed" };

  const charge = await chargeStarsByAction(params.organizationId, "message_send", {
    appSlug: "message_send",
    description: "Atendimento — mensagem automática de espera",
  });
  if (!charge.success) return { isSent: false, reason: "no_balance" };

  const sent = await resolved.provider.sendText({ kind: "text", to: lead.phone, body, typingDelayMs: 0 });
  // Já saiu para o cliente: falha ao gravar no chat não pode fazer o Inngest repetir o envio.
  const message = await persistOutboundMessage({
    conversationId: params.conversationId,
    leadId: params.leadId,
    trackingId: params.trackingId,
    body,
    senderName: params.senderName,
    externalMessageId: toLegacyUazapiMessageId(sent),
    metadata: { kind: params.kind },
  }).catch((error: unknown) => {
    console.warn("[attendance] mensagem fixa enviada, mas não gravada no chat", error);
    return null;
  });
  return { isSent: true, messageId: message?.id ?? null };
}
