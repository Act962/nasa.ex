import "server-only";

import prisma from "@/lib/prisma";
import type { Prisma, TaxKind } from "@/generated/prisma/client";
import { parseMonthKey, quarterMonths, shiftMonthKey, toQuarterKey } from "@/features/accounting/lib/format";
import { computeDas, type SimplesAnnex } from "@/features/accounting/lib/tax/simples/compute-das";
import { computeDasMei, type MeiActivity } from "@/features/accounting/lib/tax/mei/compute-das-mei";
import { computeIrpjCsllPresumido, computeMonthlyContributions } from "@/features/accounting/lib/tax/presumido/compute-presumido";
import { computeCbsIbs, resolveLegacyTaxRemainingBps } from "@/features/accounting/lib/tax/reforma/compute-cbs-ibs";
import type { CalculationResult } from "@/features/accounting/lib/tax/types";
import { loadTaxRates } from "@/features/accounting/server/tax-rates/load-tax-rates";
import { getOrCreateTaxProfile } from "@/features/accounting/server/profile/tax-profile";
import { loadRbt12, loadRevenueByMonth } from "@/features/accounting/server/revenue/load-revenue";
import { loadAvailableCredits } from "@/features/accounting/server/credits/load-available-credits";

// Apuração de um mês: calcula cada tributo do regime, grava como DRAFT com a
// memória de cálculo e nunca sobrescreve o que já foi confirmado ou pago.

interface AssessmentDraft {
  tax: TaxKind;
  period: string;
  baseCents: number;
  effectiveRateBps: number;
  amountCents: number;
  creditsCents: number;
  dueDate: Date;
  calculation: CalculationResult<unknown>;
}

export const TAX_LABELS: Record<TaxKind, string> = {
  DAS: "DAS (Simples Nacional)",
  DAS_MEI: "DAS-MEI",
  IRPJ: "IRPJ",
  CSLL: "CSLL",
  PIS: "PIS",
  COFINS: "COFINS",
  ISS: "ISS",
  ICMS: "ICMS",
  CBS: "CBS",
  IBS: "IBS",
  IS: "Imposto Seletivo",
  INSS: "INSS",
  FGTS: "FGTS",
  IRRF: "IRRF",
};

export async function assessPeriod(params: { organizationId: string; periodMonth: string }) {
  const { organizationId, periodMonth } = params;
  const profile = await getOrCreateTaxProfile(organizationId);
  const rates = await loadTaxRates(organizationId);
  const { year, month } = parseMonthKey(periodMonth);
  const at = new Date(Date.UTC(year, month - 1, 15, 12));
  const drafts: AssessmentDraft[] = [];

  if (profile.regime === "MEI") {
    const yearRevenue = await loadRevenueByMonth({ organizationId, fromMonth: `${year}-01`, toMonth: periodMonth });
    const calculation = computeDasMei({
      activity: (profile.simplesAnnex as MeiActivity | null) ?? "SERVICOS",
      yearRevenueCents: Object.values(yearRevenue).reduce((total, cents) => total + cents, 0),
      rates,
      at,
    });
    drafts.push({
      tax: "DAS_MEI",
      period: periodMonth,
      baseCents: 0,
      effectiveRateBps: 0,
      amountCents: calculation.output.amountCents,
      creditsCents: 0,
      dueDate: dueDateNextMonth(periodMonth, 20),
      calculation,
    });
  }

  if (profile.regime === "SIMPLES") {
    const rbt12 = await loadRbt12({ organizationId, periodMonth, openedAt: profile.openedAt });
    const annex = (profile.simplesAnnex as SimplesAnnex | null) ?? "III";
    const calculation = computeDas({
      rbt12Cents: rbt12.rbt12Cents,
      monthRevenueByAnnex: { [annex]: rbt12.monthRevenueCents },
      payroll12mCents: profile.payroll12mCents,
      isFatorRSubject: profile.isFatorRSubject,
      rates,
      at,
    });
    calculation.steps.unshift(...rbt12.steps);
    drafts.push({
      tax: "DAS",
      period: periodMonth,
      baseCents: rbt12.monthRevenueCents,
      effectiveRateBps: calculation.output.effectiveRateBps,
      amountCents: calculation.output.totalAmountCents,
      creditsCents: 0,
      dueDate: dueDateNextMonth(periodMonth, 20),
      calculation,
    });
  }

  if (profile.regime === "PRESUMIDO" || profile.regime === "REAL") {
    const revenueByMonth = await loadRevenueByMonth({
      organizationId,
      fromMonth: shiftMonthKey(periodMonth, -2),
      toMonth: periodMonth,
    });
    const monthRevenueCents = revenueByMonth[periodMonth] ?? 0;
    const contributions = computeMonthlyContributions({
      monthRevenueCents,
      pisCofinsRegime: profile.regime === "PRESUMIDO" ? "CUMULATIVO" : "NAO_CUMULATIVO",
      issRateBps: profile.isIssContributor ? profile.issRateBps : 0,
      issRemainingBps: resolveLegacyTaxRemainingBps(rates, "ISS", at),
      rates,
      at,
    });
    const pisCofinsDue = dueDateNextMonth(periodMonth, 25);
    if (contributions.output.pisCents > 0 || contributions.output.cofinsCents > 0) {
      drafts.push(simpleDraft("PIS", periodMonth, monthRevenueCents, contributions.output.pisCents, pisCofinsDue, contributions));
      drafts.push(simpleDraft("COFINS", periodMonth, monthRevenueCents, contributions.output.cofinsCents, pisCofinsDue, contributions));
    }
    if (contributions.output.issCents > 0) {
      drafts.push(simpleDraft("ISS", periodMonth, monthRevenueCents, contributions.output.issCents, dueDateNextMonth(periodMonth, 15), contributions));
    }

    const isQuarterEnd = month % 3 === 0;
    if (profile.regime === "PRESUMIDO" && isQuarterEnd) {
      const quarterKey = toQuarterKey(periodMonth);
      const quarterRevenue = await loadRevenueByMonth({
        organizationId,
        fromMonth: quarterMonths(quarterKey)[0],
        toMonth: periodMonth,
      });
      const quarterRevenueCents = Object.values(quarterRevenue).reduce((total, cents) => total + cents, 0);
      const irpjCsll = computeIrpjCsllPresumido({
        quarterRevenueCents,
        irpjBaseBps: profile.presumedIrpjBaseBps,
        csllBaseBps: profile.presumedCsllBaseBps,
        rates,
        at,
      });
      const quarterDue = lastBusinessDayOfMonth(shiftMonthKey(periodMonth, 1));
      drafts.push(simpleDraft("IRPJ", quarterKey, quarterRevenueCents, irpjCsll.output.irpjCents + irpjCsll.output.irpjAdditionalCents, quarterDue, irpjCsll));
      drafts.push(simpleDraft("CSLL", quarterKey, quarterRevenueCents, irpjCsll.output.csllCents, quarterDue, irpjCsll));
    }
  }

  if (year >= 2026) {
    const isInsideDas = (profile.regime === "SIMPLES" || profile.regime === "MEI") && (year === 2026 || !profile.ibsCbsOutsideSimples);
    if (!isInsideDas) {
      const monthRevenue = (await loadRevenueByMonth({ organizationId, fromMonth: periodMonth, toMonth: periodMonth }))[periodMonth] ?? 0;
      const credits = await loadAvailableCredits({ organizationId, upToMonth: periodMonth });
      const reform = computeCbsIbs({
        revenueCents: monthRevenue,
        cbsCreditsCents: credits.cbsCents,
        ibsCreditsCents: credits.ibsCents,
        regime: profile.regime,
        ibsCbsOutsideSimples: profile.ibsCbsOutsideSimples,
        rates,
        at,
      });
      const reformDue = dueDateNextMonth(periodMonth, 20);
      const isInformative = reform.output.isInformativeOnly;
      drafts.push({
        tax: "CBS",
        period: periodMonth,
        baseCents: monthRevenue,
        effectiveRateBps: reform.output.cbsRateBps,
        amountCents: isInformative ? 0 : reform.output.cbsDueCents,
        creditsCents: reform.output.cbsCreditsUsedCents,
        dueDate: reformDue,
        calculation: reform,
      });
      drafts.push({
        tax: "IBS",
        period: periodMonth,
        baseCents: monthRevenue,
        effectiveRateBps: reform.output.ibsRateBps,
        amountCents: isInformative ? 0 : reform.output.ibsDueCents,
        creditsCents: reform.output.ibsCreditsUsedCents,
        dueDate: reformDue,
        calculation: reform,
      });
    }
  }

  const saved = [];
  for (const draft of drafts) {
    const existing = await prisma.taxAssessment.findUnique({
      where: { organizationId_tax_period: { organizationId, tax: draft.tax, period: draft.period } },
      select: { id: true, status: true },
    });
    if (existing && (existing.status === "CONFIRMED" || existing.status === "PAID")) {
      saved.push(existing.id);
      continue;
    }
    const data = {
      baseCents: draft.baseCents,
      effectiveRateBps: draft.effectiveRateBps,
      amountCents: draft.amountCents,
      creditsCents: draft.creditsCents,
      dueDate: draft.dueDate,
      status: "DRAFT" as const,
      calculationMemo: toMemoJson(draft.calculation),
    };
    const upserted = await prisma.taxAssessment.upsert({
      where: { organizationId_tax_period: { organizationId, tax: draft.tax, period: draft.period } },
      create: { organizationId, tax: draft.tax, period: draft.period, ...data },
      update: data,
      select: { id: true },
    });
    saved.push(upserted.id);
  }

  return prisma.taxAssessment.findMany({ where: { id: { in: saved } }, orderBy: { tax: "asc" } });
}

function simpleDraft(
  tax: TaxKind,
  period: string,
  baseCents: number,
  amountCents: number,
  dueDate: Date,
  calculation: CalculationResult<unknown>,
): AssessmentDraft {
  return {
    tax,
    period,
    baseCents,
    effectiveRateBps: baseCents > 0 ? Math.round((amountCents / baseCents) * 10000) : 0,
    amountCents,
    creditsCents: 0,
    dueDate,
    calculation,
  };
}

function toMemoJson(calculation: CalculationResult<unknown>): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify({
      steps: calculation.steps,
      warnings: calculation.warnings,
      sources: calculation.sources,
      output: calculation.output,
    }),
  ) as Prisma.InputJsonValue;
}

function dueDateNextMonth(periodMonth: string, day: number): Date {
  const { year, month } = parseMonthKey(shiftMonthKey(periodMonth, 1));
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return previousBusinessDay(date);
}

function lastBusinessDayOfMonth(monthKey: string): Date {
  const { year, month } = parseMonthKey(monthKey);
  return previousBusinessDay(new Date(Date.UTC(year, month, 0, 12)));
}

function previousBusinessDay(date: Date): Date {
  const weekday = date.getUTCDay();
  if (weekday === 6) return new Date(date.getTime() - 86_400_000);
  if (weekday === 0) return new Date(date.getTime() - 2 * 86_400_000);
  return date;
}
