import "server-only";
import prisma from "@/lib/prisma";
import { makeSendButtonsTool } from "../server/tools/send-buttons";
import type { AgentContext } from "./context";
import { findTopicAnswer, isTopicOptionId, topicAnswerBody } from "./topic-menu";

// Clique numa pergunta do menu de um assunto (spec 0096): o código responde com o texto do roteiro e
// repete as opções, numa mensagem só. Nenhuma chamada de IA. O id do clique vem de fora: só vale se
// for de um menu de perguntas ativo deste funil, e a resposta enviada é a que está gravada no menu.

export async function handleTopicMenu(ctx: AgentContext, inboundMessageId: string): Promise<{ handled: boolean }> {
  if (ctx.catalogOrder || !ctx.lead.phone || !ctx.instance) return { handled: false };
  const inbound = await prisma.message.findFirst({
    where: { id: inboundMessageId, conversationId: ctx.conversation.id, fromMe: false },
    select: { metadata: true },
  });
  const replyId = (inbound?.metadata as { interactiveReplyId?: unknown } | null)?.interactiveReplyId;
  if (!isTopicOptionId(replyId)) return { handled: false };
  const match = findTopicAnswer(ctx.availableButtonPresets, replyId);
  // Opção de um menu que não existe mais (roteiro refeito): a assistente responde no lugar.
  if (!match) return { handled: false };

  // A resposta e as mesmas opções, numa mensagem só.
  const answerMenu = { ...match.preset, bodyText: topicAnswerBody(match.answer) };
  const sendMenu = makeSendButtonsTool({ ...ctx, availableButtonPresets: [answerMenu] }) as unknown as {
    execute: (input: { presetId: string }, options: { toolCallId: string; messages: [] }) => Promise<{ ok?: boolean }>;
  };
  const sent = await sendMenu.execute({ presetId: answerMenu.id }, { toolCallId: `topic-menu-${Date.now()}`, messages: [] });
  // Se o menu não saiu (limite do canal, por exemplo), a assistente responde.
  return { handled: sent.ok === true };
}
