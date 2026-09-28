/**
 * Cron: detect-chat-timeouts
 *
 * Varre conversas ativas sem resposta há mais de 10 min e mais de 30 min, e
 * emite penalidade de gamificação.
 *
 * ⚠️ A penalidade é emitida A CADA EXECUÇÃO enquanto a conversa seguir parada —
 * não há marca de "já penalizado". Na prática isso faz a punição depender da
 * cadência do cron, não do comportamento do atendente: a 5 minutos, uma
 * conversa parada por uma hora gerava 12 penalidades.
 *
 * A cadência caiu para 15 minutos, o que reduz o efeito em 3x mas não corrige a
 * causa. O conserto de verdade é marcar a conversa já penalizada — e isso muda
 * a régua de pontuação, então é decisão de produto, não de custo.
 *
 * Os limites de 10 e 30 min continuam sendo detectados: a cada passagem toda
 * conversa que cruzou qualquer um dos dois aparece na consulta.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { emitTrackingBatch, type TrackingEvent } from "@/features/space-point/lib/tracking-emitter";

export const detectChatTimeout = inngest.createFunction(
  { id: "detect-chat-timeouts", retries: 1 },
  { cron: "*/15 * * * *" }, // ver aviso no topo: penalidade ainda acumula
  async () => {
    const now = new Date();
    const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

    // Busca conversas ativas com ultima mensagem antiga
    const staleConversations = await prisma.conversation.findMany({
      where: {
        isActive: true,
        lastMessageAt: { lt: tenMinAgo },
      },
      select: {
        id: true,
        lastMessageAt: true,
        tracking: {
          select: {
            organizationId: true,
            participants: {
              where: { role: { in: ["OWNER", "ADMIN"] } },
              select: { userId: true },
              take: 1,
            },
          },
        },
      },
      take: 200,
    });

    const events: TrackingEvent[] = [];

    for (const conv of staleConversations) {
      const orgId = conv.tracking?.organizationId;
      const agentUserId = conv.tracking?.participants[0]?.userId;
      if (!agentUserId || !orgId) continue;

      const isOver30min = conv.lastMessageAt < thirtyMinAgo;
      events.push({
        userId: agentUserId,
        orgId,
        action: isOver30min ? "penalty_chat_30min" : "penalty_chat_10min",
        metadata: { conversationId: conv.id },
        source: "cron",
      });
    }

    for (let i = 0; i < events.length; i += 100) {
      await emitTrackingBatch(events.slice(i, i + 100));
    }

    return { processed: events.length };
  },
);
