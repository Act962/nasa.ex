/**
 * Cron: detect-chat-timeouts
 * Roda a cada 5 minutos — varre conversas ativas sem resposta
 * > 10 min e > 30 min, emite penalidades.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { emitTrackingBatch, type TrackingEvent } from "@/lib/tracking-emitter";

export const detectChatTimeout = inngest.createFunction(
  { id: "detect-chat-timeouts", retries: 1 },
  { cron: "*/5 * * * *" }, // 5 em 5 min
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
