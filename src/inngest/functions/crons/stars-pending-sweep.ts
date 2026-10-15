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

import prisma from "@/lib/prisma";
import type { InlineStep } from "@/inngest/inline-step";

const STALE_HOURS = 24;

export async function runStarsPendingSweep(step: InlineStep) {
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
}
