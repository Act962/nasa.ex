/**
 * Cron: check-login-streaks
 * Roda diariamente a 1h — calcula streaks de login
 * consecutivo de 7 e 30 dias.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { emitTrackingBatch, type TrackingEvent } from "@/lib/tracking-emitter";

export const checkStreaks = inngest.createFunction(
  { id: "check-login-streaks", retries: 1 },
  { cron: "0 1 * * *" }, // 1h diario
  async () => {
    const now = new Date();
    const events: TrackingEvent[] = [];

    // Busca users com presenca recente (ativos nos ultimos 24h)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const activePresences = await prisma.userPresence.findMany({
      where: { lastSeenAt: { gte: oneDayAgo } },
      select: { userId: true, organizationId: true },
    });

    for (const p of activePresences) {
      // Contar dias unicos de login nos ultimos 30 dias
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const loginLogs = await prisma.systemActivityLog.findMany({
        where: {
          userId: p.userId,
          organizationId: p.organizationId,
          action: "auth.login",
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
      });

      // Extrair dias unicos
      const uniqueDays = new Set(
        loginLogs.map((l) => l.createdAt.toISOString().slice(0, 10)),
      );

      // Calcular streak consecutivo (de hoje para tras)
      let streak = 0;
      const today = new Date(now);
      for (let i = 0; i < 30; i++) {
        const day = new Date(today);
        day.setDate(day.getDate() - i);
        const dayStr = day.toISOString().slice(0, 10);
        if (uniqueDays.has(dayStr)) {
          streak++;
        } else {
          break;
        }
      }

      if (streak >= 30) {
        events.push({ userId: p.userId, orgId: p.organizationId, action: "login_streak_30days", source: "cron" });
      } else if (streak >= 7) {
        events.push({ userId: p.userId, orgId: p.organizationId, action: "login_streak_7days", source: "cron" });
      }
    }

    for (let i = 0; i < events.length; i += 100) {
      await emitTrackingBatch(events.slice(i, i + 100));
    }

    return { processed: events.length };
  },
);
