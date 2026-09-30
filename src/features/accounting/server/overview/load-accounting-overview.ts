import "server-only";

import prisma from "@/lib/prisma";
import type { TaxRegime } from "@/generated/prisma/client";
import { shiftMonthKey, toMonthKey } from "@/features/accounting/lib/format";
import { findDocumentType } from "@/features/accounting/lib/compliance/document-catalog";
import { loadRegularityScore } from "@/features/accounting/server/compliance/load-regularity";
import { loadAvailableCredits } from "@/features/accounting/server/credits/load-available-credits";

// Leitura da "Visão geral" da aba Contábil. Um serviço só para a tela e para o
// ASTRO darem os mesmos números. Recebe o perfil pronto: a tela cria o perfil
// na primeira visita, o ASTRO nunca cria.

const NEXT_OBLIGATIONS_LIMIT = 6;

export interface AccountingOverviewProfile {
  regime: TaxRegime;
  onboardingCompletedAt: Date | null;
}

export async function loadAccountingOverview(params: {
  organizationId: string;
  profile: AccountingOverviewProfile;
  now?: Date;
}) {
  const { organizationId, profile } = params;
  const now = params.now ?? new Date();
  const lastMonth = shiftMonthKey(toMonthKey(now), -1);
  const lastQuarter = `${lastMonth.slice(0, 4)}-T${Math.ceil(Number(lastMonth.slice(5)) / 3)}`;

  const [score, obligations, overdueCount, lastMonthAssessments, credits, paidWithoutInvoiceCount] = await Promise.all([
    loadRegularityScore(organizationId, now),
    prisma.fiscalObligation.findMany({
      where: { organizationId, status: { in: ["PENDING", "OVERDUE"] } },
      orderBy: { dueDate: "asc" },
      take: NEXT_OBLIGATIONS_LIMIT,
    }),
    prisma.fiscalObligation.count({ where: { organizationId, status: "OVERDUE" } }),
    prisma.taxAssessment.findMany({
      where: { organizationId, period: { in: [lastMonth, lastQuarter] } },
      select: { status: true, amountCents: true },
    }),
    loadAvailableCredits({ organizationId, upToMonth: toMonthKey(now) }),
    prisma.paymentEntry.count({
      where: {
        organizationId,
        type: "PAYABLE",
        status: "PAID",
        paidAt: { gte: new Date(`${lastMonth}-01T00:00:00Z`) },
        attachments: { none: { kind: { in: ["NOTA_FISCAL", "RECIBO"] } } },
        NOT: { category: { name: "Impostos e taxas" } },
      },
    }),
  ]);

  return {
    regime: profile.regime,
    isOnboarded: Boolean(profile.onboardingCompletedAt),
    scoreBps: score.scoreBps,
    blockingCount: score.blockingItems.length,
    pendingItemsCount: score.applicableCount - score.okCount,
    overdueObligationsCount: overdueCount,
    nextObligations: obligations.map((obligation) => ({
      id: obligation.id,
      kind: obligation.kind,
      label: findDocumentType(obligation.kind)?.label ?? obligation.kind,
      period: obligation.period,
      dueDate: obligation.dueDate,
      status: obligation.status,
    })),
    lastMonth: {
      period: lastMonth,
      draftCount: lastMonthAssessments.filter((assessment) => assessment.status === "DRAFT").length,
      totalAmountCents: lastMonthAssessments.reduce((total, assessment) => total + assessment.amountCents, 0),
      hasAssessment: lastMonthAssessments.length > 0,
    },
    availableCredits: credits,
    paidWithoutInvoiceCount,
  };
}

export type AccountingOverview = Awaited<ReturnType<typeof loadAccountingOverview>>;
