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

export const listSalesGoalPeriods = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ periodType: periodTypeSchema.optional() }).optional())
  .handler(async ({ input, context }) => {
    return prisma.salesGoalPeriod.findMany({
      where: {
        organizationId: context.org.id,
        ...(input?.periodType ? { periodType: input.periodType } : {}),
      },
      orderBy: { periodStart: "desc" },
      select: {
        id: true,
        periodType: true,
        periodStart: true,
        periodEnd: true,
        label: true,
      },
    });
  });
