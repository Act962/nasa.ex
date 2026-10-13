import "server-only";
import prisma from "@/lib/prisma";
import { interruptOf, isStepReplyId, readAwaitingStepReply } from "@/features/workflows/lib/conversation-steps";
import type { AgentContext } from "./context";

// Um passo de fluxo perguntou algo e espera a resposta (spec 0099, D-6): essa mensagem é do fluxo.
// Sem isso a assistente responderia ao CPF que o cliente acabou de digitar. A espera é lida da
// mensagem enviada logo antes da resposta do cliente, e vence sozinha no prazo do passo.

export async function isReplyForWaitingFlow(ctx: AgentContext, inboundMessageId: string): Promise<boolean> {
  const inbound = await prisma.message.findFirst({
    where: { id: inboundMessageId, conversationId: ctx.conversation.id, fromMe: false },
    select: { body: true, metadata: true, createdAt: true },
  });
  if (!inbound) return false;
  const clickedId = (inbound.metadata as { interactiveReplyId?: unknown } | null)?.interactiveReplyId;
  // Clique num botão de passo de conversa é sempre do fluxo, mesmo que a espera já tenha vencido.
  if (isStepReplyId(clickedId)) return true;

  const previousOutbound = await prisma.message.findFirst({
    where: { conversationId: ctx.conversation.id, fromMe: true, createdAt: { lt: inbound.createdAt } },
    orderBy: { createdAt: "desc" },
    select: { metadata: true },
  });
  if (!readAwaitingStepReply(previousOutbound?.metadata, inbound.createdAt)) return false;
  // "menu", "cancelar" e "falar com atendente" tiram o cliente do passo: quem responde é o atendimento.
  return interruptOf(inbound.body ?? "") === null;
}
