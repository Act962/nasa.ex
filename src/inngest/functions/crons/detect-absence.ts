/**
 * Cron: detect-absence
 * Roda diariamente as 8h — varre users sem login > 2/3/7 dias
 * e emite penalidades de ausencia.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { emitTrackingBatch, type TrackingEvent } from "@/lib/tracking-emitter";

export const detectAbsence = inngest.createFunction(
  { id: "detect-absence", retries: 1 },
  { cron: "0 8 * * *" }, // 8h diario
  async () => {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Busca users com lastSeenAt antigo agrupado por org
    const presences = await prisma.userPresence.findMany({
      where: { lastSeenAt: { lt: twoDaysAgo } },
      select: { userId: true, organizationId: true, lastSeenAt: true },
    });

    const events: TrackingEvent[] = [];

    for (const p of presences) {
      const daysSinceLogin = Math.floor((now.getTime() - p.lastSeenAt.getTime()) / (24 * 60 * 60 * 1000));

      if (daysSinceLogin >= 7) {
        events.push({ userId: p.userId, orgId: p.organizationId, action: "penalty_absent_day7plus", source: "cron" });
      } else if (p.lastSeenAt < threeDaysAgo) {
        events.push({ userId: p.userId, orgId: p.organizationId, action: "penalty_absent_day3", source: "cron" });
      } else {
        events.push({ userId: p.userId, orgId: p.organizationId, action: "penalty_absent_day2", source: "cron" });
      }
    }

    // Emit em batch (max 100 por vez)
    for (let i = 0; i < events.length; i += 100) {
      await emitTrackingBatch(events.slice(i, i + 100));
    }

    return { processed: events.length };
  },
);
