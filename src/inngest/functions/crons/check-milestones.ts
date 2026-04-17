/**
 * Cron: check-milestones
 * Roda a cada 6h — checa contadores de acoes do usuario
 * (100 leads, 10 posts, automacao 100 runs, etc.)
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { emitTrackingBatch, type TrackingEvent } from "@/lib/tracking-emitter";

interface MilestoneCheck {
  action: string;
  countAction: string;
  threshold: number;
}

const MILESTONES: MilestoneCheck[] = [
  {
    action: "automation_100_runs",
    countAction: "workflow_execute",
    threshold: 100,
  },
];

export const checkMilestones = inngest.createFunction(
  { id: "check-milestones", retries: 1 },
  { cron: "0 */6 * * *" }, // 6 em 6h
  async () => {
    const events: TrackingEvent[] = [];

    // ── 1. Milestones Genéricos (Baseados em contagem de transações) ─────────
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const activeOrgs = await prisma.userPresence.findMany({
      where: { lastSeenAt: { gte: threeDaysAgo } },
      select: { organizationId: true, userId: true },
      distinct: ["organizationId", "userId"],
    });

    const orgUsers = new Map<string, Set<string>>();
    for (const p of activeOrgs) {
      if (!orgUsers.has(p.organizationId))
        orgUsers.set(p.organizationId, new Set());
      orgUsers.get(p.organizationId)!.add(p.userId);
    }

    for (const [orgId, userIds] of orgUsers) {
      for (const userId of userIds) {
        for (const milestone of MILESTONES) {
          const alreadyAwarded = await prisma.spacePointTransaction.findFirst({
            where: {
              userPoint: { userId, orgId },
              rule: { action: milestone.action },
            },
          });
          if (alreadyAwarded) continue;

          const count = await prisma.spacePointTransaction.count({
            where: {
              userPoint: { userId, orgId },
              rule: { action: milestone.countAction },
            },
          });

          if (count >= milestone.threshold) {
            events.push({
              userId,
              orgId,
              action: milestone.action,
              source: "cron",
            });
          }
        }
      }
    }

    // ── 2. Milestones de Formulário (Processamento em tempo real migrado para submut-response.ts) ──

    // Emitir eventos em lotes
    for (let i = 0; i < events.length; i += 100) {
      await emitTrackingBatch(events.slice(i, i + 100));
    }

    return { processed: events.length };
  },
);
