/**
 * Evento: stars/cycle.ensure
 *
 * Gatilho primário da renovação de Stars — disparado pelos hooks de assinatura
 * do better-auth/stripe. O webhook responde na hora e o crédito acontece aqui,
 * com retry do Inngest.
 *
 * O crédito em si é idempotente por `periodKey` (ver `star-cycle-service`); a
 * dedup por `event.id` abaixo é só pra evitar trabalho repetido quando o Stripe
 * reentrega o mesmo evento.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import {
  ensureStarsCycle,
  syncStarsForPlanState,
} from "@/features/stars/lib/star-cycle-service";
import type { CycleSource } from "@/features/stars/lib/star-cycle-service";

export const starsCycleEnsure = inngest.createFunction(
  { id: "stars-cycle-ensure", retries: 3 },
  { event: "stars/cycle.ensure" },
  async ({ event, step }) => {
    const organizationId = event.data.organizationId as string;
    const source = (event.data.source as CycleSource) ?? "stripe";
    const stripeEventId = event.data.stripeEventId as string | undefined;

    if (stripeEventId) {
      const isNewEvent = await step.run("dedupe-stripe-event", async () => {
        try {
          await prisma.processedStripeEvent.create({
            data: {
              id: `cycle:${stripeEventId}:${organizationId}`,
              type: (event.data.stripeEventType as string) ?? "unknown",
              source: "subscription",
            },
          });
          return true;
        } catch {
          // P2002 — este evento já foi processado para esta org.
          return false;
        }
      });

      if (!isNewEvent) {
        return { organizationId, skipped: "duplicate_stripe_event" };
      }
    }

    const nextPlanId = event.data.nextPlanId as string | undefined;

    const result = await step.run("ensure-cycle", () =>
      nextPlanId
        ? syncStarsForPlanState(organizationId, { source, nextPlanId })
        : ensureStarsCycle(organizationId, source),
    );

    return { organizationId, ...result };
  },
);
