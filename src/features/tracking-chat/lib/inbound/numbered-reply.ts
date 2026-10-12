import "server-only";
import prisma from "@/lib/prisma";
import { readNumberedOptions, resolveNumberedReply } from "@/features/tracking-chat/lib/numbered-menu";

// Resposta por número a um menu em texto numerado (spec 0095, RF-4). Em número fora da API oficial o
// menu não tem botão: "2" só vale como clique quando a ÚLTIMA mensagem enviada naquela conversa é um
// menu numerado, e só para uma opção gravada nela. Nenhum id vem do texto do cliente.

const RECENT_INBOUND_MS = 2 * 60_000;

export async function resolveNumberedTextReply(params: { phone: string; trackingId: string; texts: string[] }): Promise<{ optionId: string } | null> {
  const replyText = params.texts.find((text) => text.trim());
  if (!replyText) return null;
  const lead = await prisma.lead.findUnique({
    where: { phone_trackingId: { phone: params.phone, trackingId: params.trackingId } },
    select: { conversation: { select: { id: true } } },
  });
  const conversationId = lead?.conversation?.id;
  if (!conversationId) return null;

  const lastOutbound = await prisma.message.findFirst({
    where: { conversationId, fromMe: true },
    orderBy: { createdAt: "desc" },
    select: { metadata: true },
  });
  const chosen = resolveNumberedReply(replyText, readNumberedOptions(lastOutbound?.metadata));
  if (!chosen) return null;

  // A mensagem recebida passa a carregar a escolha, como um clique: é por aí que o atendimento e os
  // fluxos sabem que não foi texto livre.
  const inbound = await prisma.message.findFirst({
    where: { conversationId, fromMe: false, body: replyText, createdAt: { gte: new Date(Date.now() - RECENT_INBOUND_MS) } },
    orderBy: { createdAt: "desc" },
    select: { id: true, metadata: true },
  });
  if (inbound) {
    const currentMetadata = inbound.metadata && typeof inbound.metadata === "object" && !Array.isArray(inbound.metadata) ? inbound.metadata : {};
    await prisma.message.update({ where: { id: inbound.id }, data: { metadata: { ...currentMetadata, interactiveReplyId: chosen.id, numberedReply: true } } });
  }
  return { optionId: chosen.id };
}
