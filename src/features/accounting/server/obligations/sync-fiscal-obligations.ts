import "server-only";

import prisma from "@/lib/prisma";
import { shiftMonthKey, toMonthKey } from "@/features/accounting/lib/format";
import { buildFiscalCalendar } from "@/features/accounting/lib/fiscal-calendar/build-fiscal-calendar";
import type { RequirementOverride } from "@/features/accounting/lib/compliance/document-catalog";
import { getOrCreateTaxProfile, toApplicabilityProfile } from "@/features/accounting/server/profile/tax-profile";

// Mantém `FiscalObligation` coerente com o perfil: cria as obrigações dos
// meses recentes e próximos, marca PAID/DONE quando a guia foi paga ou o
// comprovante foi anexado, e OVERDUE quando passou do vencimento.

const MONTHS_BACK = 3;
const MONTHS_AHEAD = 1;

export async function loadRequirementOverrides(organizationId: string): Promise<RequirementOverride[]> {
  const rows = await prisma.companyDocumentRequirement.findMany({ where: { organizationId } });
  return rows.map((row) => ({
    typeCode: row.typeCode,
    isApplicable: row.isApplicable,
    weight: row.weight,
    defaultValidityDays: row.defaultValidityDays,
  }));
}

export async function syncFiscalObligations(organizationId: string, now: Date = new Date()) {
  const profile = await getOrCreateTaxProfile(organizationId);
  const overrides = await loadRequirementOverrides(organizationId);
  const currentMonth = toMonthKey(now);
  const firstTrackedMonth = profile.onboardingCompletedAt
    ? maxMonth(toMonthKey(profile.onboardingCompletedAt), shiftMonthKey(currentMonth, -MONTHS_BACK))
    : shiftMonthKey(currentMonth, -1);

  const planned = buildFiscalCalendar({
    profile: toApplicabilityProfile(profile),
    overrides,
    fromMonth: firstTrackedMonth,
    toMonth: shiftMonthKey(currentMonth, MONTHS_AHEAD),
  });

  for (const obligation of planned) {
    await prisma.fiscalObligation.upsert({
      where: { organizationId_kind_period: { organizationId, kind: obligation.kind, period: obligation.period } },
      create: { organizationId, kind: obligation.kind, period: obligation.period, dueDate: obligation.dueDate },
      update: { dueDate: obligation.dueDate },
    });
  }

  await refreshAssessmentPayments(organizationId);
  await refreshObligationStatuses(organizationId, now);
}

/** Guia confirmada cujo lançamento foi quitado vira PAID. */
export async function refreshAssessmentPayments(organizationId: string) {
  const confirmed = await prisma.taxAssessment.findMany({
    where: { organizationId, status: "CONFIRMED", paymentEntryId: { not: null } },
    select: { id: true, paymentEntryId: true },
  });
  if (confirmed.length === 0) return;
  const paidEntries = await prisma.paymentEntry.findMany({
    where: { id: { in: confirmed.map((assessment) => assessment.paymentEntryId!) }, status: "PAID" },
    select: { id: true },
  });
  const paidIds = new Set(paidEntries.map((entry) => entry.id));
  const toMarkPaid = confirmed.filter((assessment) => assessment.paymentEntryId && paidIds.has(assessment.paymentEntryId));
  if (toMarkPaid.length > 0) {
    await prisma.taxAssessment.updateMany({
      where: { id: { in: toMarkPaid.map((assessment) => assessment.id) } },
      data: { status: "PAID" },
    });
  }
}

async function refreshObligationStatuses(organizationId: string, now: Date) {
  const obligations = await prisma.fiscalObligation.findMany({
    where: { organizationId, status: { in: ["PENDING", "OVERDUE"] } },
    include: { assessment: { select: { status: true, amountCents: true } } },
  });
  if (obligations.length === 0) return;

  const periodDocuments = await prisma.companyDocument.findMany({
    where: {
      organizationId,
      typeCode: { in: [...new Set(obligations.map((obligation) => obligation.kind))] },
      period: { not: null },
      status: { not: "REPLACED" },
    },
    select: { typeCode: true, period: true },
  });
  const documentKeys = new Set(periodDocuments.map((document) => `${document.typeCode}:${document.period}`));

  for (const obligation of obligations) {
    const isPaidByAssessment =
      obligation.assessment?.status === "PAID" ||
      (obligation.assessment?.status === "CONFIRMED" && obligation.assessment.amountCents === 0);
    const hasProof = documentKeys.has(`${obligation.kind}:${obligation.period}`);
    const nextStatus = isPaidByAssessment || hasProof ? "DONE" : obligation.dueDate < now ? "OVERDUE" : "PENDING";
    if (nextStatus !== obligation.status) {
      await prisma.fiscalObligation.update({
        where: { id: obligation.id },
        data: { status: nextStatus, completedAt: nextStatus === "DONE" ? new Date() : null },
      });
    }
  }
}

function maxMonth(left: string, right: string): string {
  return left > right ? left : right;
}
