/**
 * Cron: nasa-route-subscription-renew
 *
 * Roda 1x por dia às 03h UTC. Varre `nasa_route_subscription` com
 * `nextChargeAt <= now()` e tenta cobrar. Reusa `chargeSubscriptionInTx`
 * que cuida do débito, crédito, atualização de status e expiração.
 *
 * Idempotência: o `nextChargeAt` é atualizado dentro da TX, então rerun
 * lê data futura e não re-cobra. Em caso de falha, empurra +1 dia
 * (retry diário até 7 dias = expira).
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { chargeSubscriptionInTx } from "@/app/router/nasa-route/helpers/subscription-helpers";

export const nasaRouteSubscriptionRenew = inngest.createFunction(
  { id: "nasa-route-subscription-renew", retries: 1 },
  { cron: "0 3 * * *" },
  async ({ step }) => {
    const due = await step.run("find-due-subscriptions", async () => {
      return prisma.nasaRouteSubscription.findMany({
        where: {
          nextChargeAt: { lte: new Date() },
          status: { in: ["active", "past_due"] },
        },
        select: {
          id: true,
          enrollment: {
            select: {
              userId: true,
              courseId: true,
              course: { select: { title: true, creatorUserId: true } },
            },
          },
        },
        take: 500,
      });
    });

    if (due.length === 0) {
      return { processed: 0, charged: 0, failed: 0 };
    }

    let charged = 0;
    let failed = 0;
    let expired = 0;

    for (const item of due) {
      const result = await step.run(`charge-${item.id}`, async () => {
        return prisma.$transaction(async (tx) => {
          return chargeSubscriptionInTx({ tx, subscriptionId: item.id });
        });
      });

      if (result.ok) {
        charged++;
        // Push de sucesso (best-effort)
        try {
          await pusherServer.trigger(
            `private-user-${item.enrollment.userId}`,
            "nasaroute:subscription-renewed",
            {
              courseId: item.enrollment.courseId,
              courseTitle: item.enrollment.course.title,
              paidStars: result.paidStars,
              nextChargeAt: result.nextChargeAt,
            },
          );
        } catch (err) {
          console.error("[subscription-renew] pusher error:", err);
        }
      } else {
        failed++;
        if (result.status === "expired") {
          expired++;
        }
        // Push de falha (best-effort)
        try {
          await pusherServer.trigger(
            `private-user-${item.enrollment.userId}`,
            "nasaroute:subscription-charge-failed",
            {
              courseId: item.enrollment.courseId,
              courseTitle: item.enrollment.course.title,
              reason: result.reason,
              status: result.status,
              failedChargeCount: result.failedChargeCount,
            },
          );
        } catch (err) {
          console.error("[subscription-renew] pusher error:", err);
        }
      }
    }

    return {
      processed: due.length,
      charged,
      failed,
      expired,
    };
  },
);
