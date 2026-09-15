import "server-only";

import prisma from "@/lib/prisma";
import { buildProjection, type ProjectionResult } from "./build-projection";

// Projeção financeira (spec 0009) como serviço: busca e delega para o cálculo
// puro de `build-projection.ts`.

export const PROJECTION_HORIZON_OPTIONS = [3, 6, 12] as const;
export type ProjectionHorizon = (typeof PROJECTION_HORIZON_OPTIONS)[number];
export const DEFAULT_TREND_WINDOW_MONTHS = 6;

export async function loadPaymentProjection(params: {
  organizationId: string;
  horizonMonths?: number;
  trendWindowMonths?: number;
  categoryIds?: string[];
}): Promise<ProjectionResult & { accountsCount: number }> {
  const today = new Date();
  const horizonMonths = PROJECTION_HORIZON_OPTIONS.includes(
    params.horizonMonths as ProjectionHorizon,
  )
    ? (params.horizonMonths as ProjectionHorizon)
    : 6;
  const trendWindowMonths = params.trendWindowMonths ?? DEFAULT_TREND_WINDOW_MONTHS;

  // Janela de leitura: do início do histórico usado até o fim do horizonte.
  const historyStart = new Date(today.getFullYear(), today.getMonth() - trendWindowMonths, 1);
  const horizonEnd = new Date(today.getFullYear(), today.getMonth() + horizonMonths, 0, 23, 59, 59);

  const [accounts, entries] = await Promise.all([
    prisma.paymentBankAccount.findMany({
      where: { organizationId: params.organizationId, isActive: true },
      select: { balance: true },
    }),
    prisma.paymentEntry.findMany({
      where: {
        organizationId: params.organizationId,
        ...(params.categoryIds && params.categoryIds.length > 0
          ? { categoryId: { in: params.categoryIds } }
          : {}),
        status: { not: "CANCELLED" },
        OR: [
          { dueDate: { gte: historyStart, lte: horizonEnd } },
          { paidAt: { gte: historyStart, lte: horizonEnd } },
          // Vencido antigo ainda em aberto: fora da janela por data, mas é
          // caixa futuro e precisa entrar no mês 1 (RF-7).
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

  const openingBalance = accounts.reduce((total, account) => total + account.balance, 0);

  const projection = buildProjection({
    entries,
    openingBalance,
    horizonMonths,
    trendWindowMonths,
    today,
  });

  return { ...projection, accountsCount: accounts.length };
}
