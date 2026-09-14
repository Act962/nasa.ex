/**
 * Cron: trafego-pix-pending-sweep
 *
 * De hora em hora, marca como `EXPIRED` as cobranças PIX que passaram da
 * validade sem comprovante. Não cancela nada: `confirmPix` continua aceitando
 * pendência expirada, porque quem paga atrasado tem o dinheiro na nossa conta
 * do mesmo jeito. O status serve para a fila da equipe separar o que esfriou.
 */

import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";

export const trafegoPixPendingSweep = inngest.createFunction(
  { id: "trafego-pix-pending-sweep", retries: 1 },
  { cron: "15 * * * *" },
  async ({ step }) => {
    const now = new Date();

    const result = await step.run("expire-pix-pendings", () =>
      prisma.trafegoPendingPurchase.updateMany({
        where: {
          paymentMethod: "PIX",
          status: "PENDING",
          pixExpiresAt: { lt: now },
        },
        data: { status: "EXPIRED" },
      }),
    );

    return { expired: result.count, at: now.toISOString() };
  },
);
