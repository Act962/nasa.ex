import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { chargeSalvyNumberMonthly } from "@/features/campanhas/server/lib/salvy-numbers";

/** Cron diário da mensalidade em Stars dos números Salvy (spec 0040, RF-5). */

const BATCH_LIMIT = 500;

export const salvyNumberMonthlyBilling = inngest.createFunction(
  { id: "salvy-number-monthly-billing", retries: 1 },
  { cron: "TZ=America/Sao_Paulo 30 6 * * *" },
  async ({ step }) => {
    const dueNumbers = await step.run("load-due-numbers", () =>
      prisma.salvyVirtualNumber.findMany({
        where: { status: { not: "canceled" }, nextChargeAt: { not: null, lte: new Date() } },
        select: { id: true },
        take: BATCH_LIMIT,
      }),
    );

    const outcomes: Record<string, number> = {};
    for (const number of dueNumbers) {
      const outcome = await step.run(`charge-${number.id}`, () => chargeSalvyNumberMonthly(number.id));
      outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
    }
    return { due: dueNumbers.length, ...outcomes };
  },
);
