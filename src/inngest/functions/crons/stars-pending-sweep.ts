/**
 * Cron: stars-pending-sweep
 *
 * Roda de hora em hora. Marca como `expired` os `StarsPayment` Stripe que
 * ficaram `pending` por mais de 24h sem evento de confirmação/expiração
 * entregue (sessão abandonada cujo `checkout.session.expired` não chegou).
 *
 * Defense-in-depth — o crédito real só acontece via webhook em pagamentos
 * `paid`, então varrer pendências órfãs é seguro e só limpa o funil.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";

const STALE_HOURS = 24;

export const starsPendingSweep = inngest.createFunction(
  { id: "stars-pending-sweep", retries: 1 },
  { cron: "0 * * * *" }, // de hora em hora
  async ({ step }) => {
    const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);

    const result = await step.run("expire-stale-pendings", () =>
      prisma.starsPayment.updateMany({
        where: {
          provider: "stripe",
          status: "pending",
          createdAt: { lt: cutoff },
        },
        data: { status: "expired" },
      }),
    );

    return { expired: result.count, cutoff: cutoff.toISOString() };
  },
);
