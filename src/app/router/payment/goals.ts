import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";
import prisma from "@/lib/prisma";
import { loadGoalStatus } from "@/features/payment/server/goals/goal-status";
import { z } from "zod";

const goalStatusSchema = z.object({
  year: z.number(),
  month: z.number(),
  revenueTargetCents: z.number(),
  cashReservePercent: z.number(),
  hasRevenueTarget: z.boolean(),
  hasMonthOverride: z.boolean(),
  receivedRevenue: z.number(),
  salesRevenue: z.number(),
  projectedRevenue: z.number(),
  paidExpense: z.number(),
  openPayable: z.number(),
  projectedExpense: z.number(),
  projectedCash: z.number(),
  reserveTargetNow: z.number(),
  reserveTargetProjected: z.number(),
  reserveGap: z.number(),
  goalProgressPercent: z.number(),
  isGoalReached: z.boolean(),
  isReserveAtRisk: z.boolean(),
});

const configSchema = z.object({
  defaultRevenueTargetCents: z.number(),
  defaultCashReservePercent: z.number(),
  alertReserveAtRisk: z.boolean(),
  alertWeeklySummary: z.boolean(),
  alertGoalReached: z.boolean(),
  alertExpenseBreaksReserve: z.boolean(),
});

const DEFAULT_CONFIG = {
  defaultRevenueTargetCents: 0,
  defaultCashReservePercent: 0,
  alertReserveAtRisk: true,
  alertWeeklySummary: true,
  alertGoalReached: true,
  alertExpenseBreaksReserve: true,
};

export const getPaymentGoalStatus = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("dashboard", "view"))
  .route({ method: "GET", summary: "Get monthly goal status", tags: ["Payment"] })
  .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
  .output(z.object({ status: goalStatusSchema, config: configSchema }))
  .handler(async ({ input, context, errors }) => {
    try {
      const [status, config] = await Promise.all([
        loadGoalStatus({
          organizationId: context.org.id,
          year: input.year,
          month: input.month,
        }),
        prisma.paymentGoalConfig.findUnique({
          where: { organizationId: context.org.id },
          select: {
            defaultRevenueTargetCents: true,
            defaultCashReservePercent: true,
            alertReserveAtRisk: true,
            alertWeeklySummary: true,
            alertGoalReached: true,
            alertExpenseBreaksReserve: true,
          },
        }),
      ]);
      return { status, config: config ?? DEFAULT_CONFIG };
    } catch (err) {
      console.error("[payment/goals/status]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const updatePaymentGoalConfig = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("settings", "edit"))
  .route({ method: "POST", summary: "Upsert payment goal config", tags: ["Payment"] })
  .input(z.object({
    defaultRevenueTargetCents: z.number().min(0),
    defaultCashReservePercent: z.number().min(0).max(100),
    alertReserveAtRisk: z.boolean(),
    alertWeeklySummary: z.boolean(),
    alertGoalReached: z.boolean(),
    alertExpenseBreaksReserve: z.boolean(),
  }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      await prisma.paymentGoalConfig.upsert({
        where: { organizationId: context.org.id },
        create: { organizationId: context.org.id, ...input },
        update: input,
      });
      return { success: true };
    } catch (err) {
      console.error("[payment/goals/update-config]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const upsertPaymentGoalMonth = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("settings", "edit"))
  .route({ method: "POST", summary: "Upsert monthly goal override", tags: ["Payment"] })
  .input(z.object({
    year: z.number(),
    month: z.number().min(1).max(12),
    // null limpa o override do campo e volta a herdar o padrão (CB-8).
    revenueTargetCents: z.number().min(0).nullable(),
    cashReservePercent: z.number().min(0).max(100).nullable(),
  }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const { year, month, revenueTargetCents, cashReservePercent } = input;
      await prisma.paymentGoalMonth.upsert({
        where: {
          organizationId_year_month: {
            organizationId: context.org.id,
            year,
            month,
          },
        },
        create: {
          organizationId: context.org.id,
          year,
          month,
          revenueTargetCents,
          cashReservePercent,
        },
        update: { revenueTargetCents, cashReservePercent },
      });
      return { success: true };
    } catch (err) {
      console.error("[payment/goals/upsert-month]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
