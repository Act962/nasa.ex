import "server-only";
import prisma from "@/lib/prisma";
import { sendText } from "@/http/uazapi/send-text";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { buildDailySummary, type DailySummary } from "../daily-summary";
import { DAILY_SUMMARY_PREFIX, GROUP_MESSAGE_MAX_CHARS, isGroupJid } from "../group-message";
import { interpolate, type WorkflowContext } from "../workflow-context";
import type { NodeExecutionResult } from "../run-workflow";

// Envia um texto para um grupo de WhatsApp (spec 0101). Grupo só existe em número conectado por QR code:
// a API oficial não envia para grupos.

function failed(errorMessage: string, error: string): NodeExecutionResult {
  return { output: { error }, status: "FAILED", errorMessage };
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Empresa dona da execução: vem do gatilho agendado ou do funil do lead, nunca do passo. */
async function resolveOrganizationId(context: WorkflowContext): Promise<string | null> {
  const fromTrigger = readString(context.trigger?.organizationId);
  if (fromTrigger) return fromTrigger;
  const leadTrackingId = readString(context.lead?.trackingId);
  if (!leadTrackingId) return null;
  const tracking = await prisma.tracking.findUnique({ where: { id: leadTrackingId }, select: { organizationId: true } });
  return tracking?.organizationId ?? null;
}

export async function runGroupMessageStep(params: { payload: Record<string, unknown>; context: WorkflowContext; dryRun: boolean }): Promise<NodeExecutionResult> {
  const { payload, context, dryRun } = params;
  const groupJid = readString(payload.groupJid);
  const senderTrackingId = readString(payload.trackingId);
  const rawMessage = readString(payload.message);
  if (!isGroupJid(groupJid)) return failed("Escolha o grupo que vai receber a mensagem", "group_missing");
  if (!senderTrackingId) return failed("Escolha o funil cujo número envia a mensagem", "sender_tracking_missing");
  if (!rawMessage) return failed("Escreva a mensagem que será enviada", "empty_message");

  const organizationId = await resolveOrganizationId(context);
  if (!organizationId) return failed("Não foi possível identificar a empresa desta execução", "organization_missing");

  // O funil gravado no passo é dado editável: só vale se for da mesma empresa da execução.
  const instance = await prisma.whatsAppInstance.findFirst({
    where: { trackingId: senderTrackingId, tracking: { organizationId } },
    select: { provider: true, status: true, apiKey: true, baseUrl: true, isActive: true },
  });
  if (!instance) return failed("O funil escolhido não tem número de WhatsApp nesta empresa", "sender_instance_missing");
  if (instance.provider !== "UAZAPI" || !instance.apiKey) {
    return failed("Grupo só recebe mensagem de número conectado por QR code; a API oficial não envia para grupos", "official_number_cannot_send_to_group");
  }
  if (instance.status !== "CONNECTED" || !instance.isActive) return failed("O número do funil escolhido está desconectado", "sender_disconnected");

  const summaryVars = rawMessage.includes(DAILY_SUMMARY_PREFIX) ? await buildDailySummary(organizationId) : null;
  // `{{resumo.x}}` é lido da raiz do contexto, ao lado de `lead` e `vars`.
  const contextWithSummary: WorkflowContext & { resumo?: DailySummary } = summaryVars ? { ...context, resumo: summaryVars } : context;
  const text = interpolate(contextWithSummary, rawMessage).trim().slice(0, GROUP_MESSAGE_MAX_CHARS);
  if (!text) return failed("Mensagem vazia depois de preencher as variáveis", "empty_message");

  if (dryRun) return { output: { dryRun: true, type: "GROUP_TEXT", group: readString(payload.groupName) || groupJid, preview: text.slice(0, 300) } };

  const charge = await chargeStarsByAction(organizationId, "message_send", { appSlug: "message_send", description: "Fluxo: mensagem para grupo" });
  if (!charge.success) return failed("Saldo de Stars insuficiente", "insufficient_stars");

  try {
    await sendText(instance.apiKey, { number: groupJid, text }, instance.baseUrl ?? undefined);
    return { output: { sent: true, type: "GROUP_TEXT", group: readString(payload.groupName) || groupJid, textPreview: text.slice(0, 100) } };
  } catch (sendError) {
    const errorMessage = sendError instanceof Error ? sendError.message : "send_failed";
    return failed(errorMessage, errorMessage);
  }
}
