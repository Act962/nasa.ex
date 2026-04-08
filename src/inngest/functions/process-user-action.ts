/**
 * processUserAction — Processador central do Event Bus.
 *
 * Recebe "user/action.tracked" e:
 * 1. Busca regras SP + Stars da org (cache in-memory)
 * 2. Aplica SP (awardPoints) se regra existir
 * 3. Debita Stars se regra existir
 * 4. Envia resultado via Pusher ao usuario
 */

import { inngest } from "@/inngest/client";
import { getOrgRules } from "@/lib/rules-cache";
import { awardPoints } from "@/app/router/space-point/utils";
import { debitStars } from "@/lib/star-service";
import { pusherServer } from "@/lib/pusher";
import { StarTransactionType } from "@/generated/prisma/client";

export const processUserAction = inngest.createFunction(
  {
    id: "process-user-action",
    concurrency: [{ limit: 10, key: "event.data.orgId" }],
    rateLimit: { limit: 100, period: "1m", key: "event.data.userId" },
    retries: 2,
  },
  { event: "user/action.tracked" },
  async ({ event }) => {
    const { userId, orgId, action, metadata } = event.data as {
      userId: string;
      orgId: string;
      action: string;
      metadata?: Record<string, unknown>;
      source: string;
    };

    const { spRules, starRules } = await getOrgRules(orgId);

    let spAwarded = 0;
    let starsDebited = 0;
    let totalSP = 0;
    let popupTemplateId: string | null = null;
    let newSeals: { name: string; badgeNumber: number; planetEmoji: string; badgeUrl: string }[] = [];

    // ── 1. Space Points ──────────────────────────────────────────────────────
    const spRule = spRules.find((r) => r.action === action);
    if (spRule && spRule.points !== 0) {
      const result = await awardPoints(
        userId, orgId, action,
        undefined, metadata as object | undefined,
      );
      spAwarded = result.points;
      totalSP = result.totalPoints;
      popupTemplateId = result.popupTemplateId;
      newSeals = result.newSeals;
    }

    // ── 2. Stars Debit ───────────────────────────────────────────────────────
    const starRule = starRules.find((r) => r.action === action);
    if (starRule && starRule.stars > 0) {
      const result = await debitStars(
        orgId,
        starRule.stars,
        StarTransactionType.APP_CHARGE,
        `${starRule.stars}★ — ${action}`,
        undefined,
        userId,
      );
      if (result.success) {
        starsDebited = starRule.stars;
      }
    }

    // ── 3. Pusher notification ───────────────────────────────────────────────
    if (spAwarded !== 0 || starsDebited > 0 || newSeals.length > 0) {
      try {
        await pusherServer.trigger(`private-user-${userId}`, "points:updated", {
          spAwarded,
          starsDebited,
          totalSP,
          popupTemplateId,
          newSeals,
          action,
        });
      } catch (e) {
        console.error("[process-user-action] pusher failed:", e);
      }
    }

    return { spAwarded, starsDebited, totalSP, newSeals: newSeals.length };
  },
);
