import "server-only";
import { ANSWER_ID_PREFIX } from "./menu/menu-tree";
import type { BotButton } from "./types";

// Qual mensagem carrega os botões da pergunta que está no ar (spec 0079, RF-15). Botão fica na
// conversa para sempre: "Marketing", de uma pergunta de workspace, clicado quando a pergunta aberta
// já era outra, entrava como resposta "2" da pergunta errada.

const globalForQuestions = globalThis as unknown as { astroBotOpenQuestions?: Map<string, string> };
const openQuestionMessageIds = (globalForQuestions.astroBotOpenQuestions ??= new Map<string, string>());

/** Chamado a cada resposta enviada: só a última mensagem com opções de resposta vale. */
export function rememberOpenQuestion(bindingId: string, sentMessageId: string | null, buttons: BotButton[] | undefined): void {
  const hasAnswerButtons = (buttons ?? []).some((button) => button.id.startsWith(ANSWER_ID_PREFIX));
  if (hasAnswerButtons && sentMessageId) openQuestionMessageIds.set(bindingId, sentMessageId);
  else openQuestionMessageIds.delete(bindingId);
}

/**
 * O clique é de uma pergunta que não é mais a atual? Sem registro (servidor reiniciou) ou sem o
 * id da mensagem clicada, não dá para afirmar — quem chama usa a checagem de pergunta no ar.
 */
export function isClickFromOldQuestion(bindingId: string, clickedMessageId: string | undefined): boolean {
  const openMessageId = openQuestionMessageIds.get(bindingId);
  if (!clickedMessageId) return false;
  return openMessageId !== undefined ? openMessageId !== clickedMessageId : false;
}
