import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

const periodTypeSchema = z.enum([
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "BIMONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
]);

export const listSalesGoalEvolution = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ periodType: periodTypeSchema.optional() }).optional())
  .handler(async ({ input, context }) => {
    const periods = await prisma.salesGoalPeriod.findMany({
      where: {
        organizationId: context.org.id,
        ...(input?.periodType ? { periodType: input.periodType } : {}),
      },
      orderBy: { periodStart: "asc" },
      include: { branches: { include: { entries: true } } },
    });

    return periods.map((period) => {
      const allEntries = period.branches.flatMap((branch) => branch.entries);
      const goalTotal = allEntries.reduce((total, entry) => total + Number(entry.goalAmount), 0);
      const achievedTotal = allEntries.reduce(
        (total, entry) => total + (entry.achievedAmount !== null ? Number(entry.achievedAmount) : 0),
        0,
      );

      return {
        periodId: period.id,
        periodType: period.periodType,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        label: period.label,
        goalTotal,
        achievedTotal,
      };
    });
  });
