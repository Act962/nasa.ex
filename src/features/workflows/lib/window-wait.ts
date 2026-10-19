import "server-only";
import prisma from "@/lib/prisma";
import { getCustomerWindow } from "@/features/tracking-chat/lib/customer-window";

// "Esperar até X min antes de fechar a janela de 24 h do cliente" (spec 0113, RF-19): a recuperação sai
// ainda em texto livre. Sem janela aberta, segue na hora e o envio usa o modelo aprovado.

export const WINDOW_WAIT_TYPE = "BEFORE_WINDOW_CLOSES";
const MINUTE_MS = 60_000;

export function isWindowWait(action: Record<string, unknown>): boolean {
  return action.type === WINDOW_WAIT_TYPE;
}

/** Minutos até o ponto de envio; 0 quando a janela já fechou ou fecha antes disso. */
export async function minutesUntilWindowDeadline(params: {
  leadId: string | null | undefined;
  minutesBefore: number;
  now?: Date;
}): Promise<number> {
  if (!params.leadId) return 0;
  const conversation = await prisma.conversation.findFirst({ where: { leadId: params.leadId }, select: { id: true } });
  if (!conversation) return 0;
  const { expiresAt } = await getCustomerWindow(conversation.id);
  if (!expiresAt) return 0;
  const minutesBefore = Number.isFinite(params.minutesBefore) ? Math.max(0, params.minutesBefore) : 0;
  const deadlineMs = expiresAt.getTime() - minutesBefore * MINUTE_MS;
  return Math.max(0, Math.floor((deadlineMs - (params.now ?? new Date()).getTime()) / MINUTE_MS));
}
