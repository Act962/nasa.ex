import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { buildProjection } from "@/features/payment/server/projection/build-projection";

// Projeção financeira (spec 0009). A procedure só busca e delega: o cálculo
// mora em `build-projection.ts`, puro e conferível sem banco (D-5).

const HORIZON_OPTIONS = [3, 6, 12] as const;
const DEFAULT_TREND_WINDOW_MONTHS = 6;

export const getPaymentProjection = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("dashboard", "view"))
  .route({ method: "GET", summary: "Get financial projection", tags: ["Payment"] })
  .input(
    z.object({
      horizonMonths: z.union([z.literal(3), z.literal(6), z.literal(12)]).default(6),
      trendWindowMonths: z.number().min(1).max(24).default(DEFAULT_TREND_WINDOW_MONTHS),
    }),
  )
  .output(
    z.object({
      openingBalance: z.number(),
      accountsCount: z.number(),
      monthlyAverageIn: z.number(),
      monthlyAverageOut: z.number(),
      trendMonthsUsed: z.number(),
      hasTrendBasis: z.boolean(),
      overdueIn: z.number(),
      overdueOut: z.number(),
      months: z.array(
        z.object({
          month: z.string(),
          label: z.string(),
          committedIn: z.number(),
          committedOut: z.number(),
          estimatedIn: z.number(),
          estimatedOut: z.number(),
          overdueIn: z.number(),
          overdueOut: z.number(),
          projectedBalance: z.number(),
          confidence: z.number(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const today = new Date();
      const horizonMonths = HORIZON_OPTIONS.includes(
        input.horizonMonths as (typeof HORIZON_OPTIONS)[number],
      )
        ? input.horizonMonths
        : 6;

      // Janela de leitura: do início do histórico usado até o fim do horizonte.
      // Uma query só, sem loop por mês (RNF-1).
      const historyStart = new Date(
        today.getFullYear(),
        today.getMonth() - input.trendWindowMonths,
        1,
      );
      const horizonEnd = new Date(
        today.getFullYear(),
        today.getMonth() + horizonMonths,
        0,
        23,
        59,
        59,
      );

      const [accounts, entries] = await Promise.all([
        prisma.paymentBankAccount.findMany({
          where: { organizationId: context.org.id, isActive: true },
          select: { balance: true },
        }),
        prisma.paymentEntry.findMany({
          where: {
            organizationId: context.org.id,
            status: { not: "CANCELLED" },
            OR: [
              { dueDate: { gte: historyStart, lte: horizonEnd } },
              { paidAt: { gte: historyStart, lte: horizonEnd } },
              // Vencido antigo ainda em aberto: fora da janela por data, mas
              // é caixa futuro e precisa entrar no mês 1 (RF-7).
              { dueDate: { lt: historyStart }, status: { in: ["PENDING", "PARTIAL", "OVERDUE", "PENDING_APPROVAL"] } },
            ],
          },
          select: {
            type: true,
            status: true,
            amount: true,
            paidAmount: true,
            dueDate: true,
            paidAt: true,
          },
        }),
      ]);

      const openingBalance = accounts.reduce(
        (total, account) => total + account.balance,
        0,
      );

      const projection = buildProjection({
        entries,
        openingBalance,
        horizonMonths,
        trendWindowMonths: input.trendWindowMonths,
        today,
      });

      return { ...projection, accountsCount: accounts.length };
    } catch (err) {
      console.error("[payment/projection get]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
