import "server-only";
import { inngest } from "@/inngest/client";
import { clearGuidedSlot, isAwaitingAnswer } from "@/features/astro/actions/guided-slots";
import { TrackingProviderBotChannel } from "./tracking-provider-channel";
import { MENU_ROOT_ID } from "./menu/menu-tree";
import { clearMenuState, hasOpenMenu } from "./menu/menu-flow";
import { discardPendingTaskImage } from "@/features/astro/actions/workspace/pending-image";

// Pergunta do roteiro sem resposta (spec 0079, RF-16): depois de um tempo o Astro encerra o pedido
// e avisa. Antes a pergunta expirava em silêncio e a resposta atrasada virava um pedido sem sentido.

export const BOT_QUESTION_OPENED_EVENT = "astro-bot/question.opened";
export const BOT_MESSAGE_RECEIVED_EVENT = "astro-bot/message.received";

const DEFAULT_INACTIVITY_MINUTES = 10;

export interface BotQuestionOpenedData {
  bindingId: string;
  trackingId: string;
  phone: string;
}

/** `ASTRO_BOT_INACTIVITY_MINUTES` ajusta o prazo sem deploy; `0` desliga o aviso. */
export function inactivityMinutes(): number {
  const rawValue = process.env.ASTRO_BOT_INACTIVITY_MINUTES?.trim();
  const configured = rawValue ? Number(rawValue) : Number.NaN;
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_INACTIVITY_MINUTES;
}

function sessionIdFor(bindingId: string): string {
  return `whatsapp:${bindingId}`;
}

/** Toda mensagem do membro cancela o aviso pendente dele. Best-effort: Inngest fora do ar não derruba o bot. */
export async function notifyBotMessageReceived(bindingId: string): Promise<void> {
  if (inactivityMinutes() === 0) return;
  await inngest
    .send({ name: BOT_MESSAGE_RECEIVED_EVENT, data: { bindingId } })
    .catch((error: unknown) => console.warn("[astro-bot/inactivity] evento de mensagem falhou", error));
}

/**
 * Chamado depois que a resposta saiu: se ficou pergunta do roteiro, menu ou imagem sem destino no ar,
 * agenda o aviso. `isImageWaiting` vem de quem acabou de perguntar o destino da imagem — consultar
 * o armazenamento a cada mensagem custaria uma chamada de rede por resposta.
 */
export async function scheduleInactivityNotice(data: BotQuestionOpenedData, isImageWaiting = false): Promise<void> {
  const isSomethingOpen = isImageWaiting || isAwaitingAnswer(sessionIdFor(data.bindingId)) || hasOpenMenu(data.bindingId);
  if (inactivityMinutes() === 0 || !isSomethingOpen) return;
  await inngest
    .send({ name: BOT_QUESTION_OPENED_EVENT, data })
    .catch((error: unknown) => console.warn("[astro-bot/inactivity] agendamento falhou", error));
}

/** Roda no fim do prazo: encerra o roteiro ou o menu e avisa. `false` quando não havia mais nada no ar. */
export async function closeInactiveQuestion(data: BotQuestionOpenedData): Promise<boolean> {
  const sessionId = sessionIdFor(data.bindingId);
  // Imagem recebida e sem destino conta como pedido pela metade, e sai do armazenamento.
  const hadPendingImage = await discardPendingTaskImage(sessionId);
  const hadOpenQuestion = isAwaitingAnswer(sessionId) || hadPendingImage;
  if (!hadOpenQuestion && !hasOpenMenu(data.bindingId)) return false;
  clearGuidedSlot(sessionId);
  clearMenuState(data.bindingId);
  await new TrackingProviderBotChannel(data.trackingId).sendButtons(data.phone, {
    // Só o roteiro tinha algo pela metade; menu parado não deixou nada por gravar.
    bodyText: hadOpenQuestion
      ? "Encerrei esse pedido por falta de resposta. Nada foi gravado. Quando quiser, mande *Menu*."
      : "Encerrei o menu por falta de resposta. Quando quiser, mande *Menu*.",
    buttons: [{ id: MENU_ROOT_ID, text: "Menu", interactiveOnly: true }],
  });
  return true;
}
