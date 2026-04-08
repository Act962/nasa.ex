/**
 * Cron: detect-overdue-demands
 * Roda a cada hora — varre actions/cards com dueDate vencida
 * e emite penalidades de demanda atrasada.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { emitTrackingBatch, type TrackingEvent } from "@/lib/tracking-emitter";

export const detectOverdue = inngest.createFunction(
  { id: "detect-overdue-demands", retries: 1 },
  { cron: "0 * * * *" }, // a cada hora
  async () => {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Busca actions com dueDate vencida e nao concluidas
    const overdueActions = await prisma.action.findMany({
      where: {
        isDone: false,
        dueDate: { lt: now },
        closedAt: null,
      },
      select: {
        id: true,
        dueDate: true,
        organizationId: true,
        responsibles: {
          select: { userId: true },
          take: 1,
        },
      },
      take: 500,
    });

    const events: TrackingEvent[] = [];

    for (const action of overdueActions) {
      const orgId = action.organizationId;
      const userId = action.responsibles[0]?.userId;
      if (!orgId || !userId) continue;

      const isOverdue24h = action.dueDate && action.dueDate < twentyFourHoursAgo;
      events.push({
        userId,
        orgId,
        action: isOverdue24h ? "penalty_demand_24h" : "penalty_demand_overdue",
        metadata: { actionId: action.id },
        source: "cron",
      });
    }

    // Detectar 3+ demandas vencidas no mesmo dia por user
    const userOverdueCounts = new Map<string, number>();
    for (const ev of events) {
      const key = `${ev.userId}:${ev.orgId}`;
      userOverdueCounts.set(key, (userOverdueCounts.get(key) ?? 0) + 1);
    }
    for (const [key, count] of userOverdueCounts) {
      if (count >= 3) {
        const [userId, orgId] = key.split(":");
        events.push({ userId: userId!, orgId: orgId!, action: "penalty_3_overdue_day", source: "cron" });
      }
    }

    for (let i = 0; i < events.length; i += 100) {
      await emitTrackingBatch(events.slice(i, i + 100));
    }

    return { processed: events.length };
  },
);
