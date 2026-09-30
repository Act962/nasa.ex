import "server-only";

import prisma from "@/lib/prisma";
import { parseMonthKey, shiftMonthKey, toMonthKey } from "@/features/accounting/lib/format";
import {
  COMPANY_DOCUMENT_TYPES,
  isDocumentApplicable,
  type ApplicabilityProfile,
  type RequirementOverride,
} from "@/features/accounting/lib/compliance/document-catalog";
import {
  computeRegularityScore,
  type MonthlyFulfillment,
  type RegularityScore,
} from "@/features/accounting/lib/compliance/compute-regularity-score";
import { getOrCreateTaxProfile, toApplicabilityProfile } from "@/features/accounting/server/profile/tax-profile";
import { loadRequirementOverrides } from "@/features/accounting/server/obligations/sync-fiscal-obligations";

const MONTHS_EVALUATED = 3;
const TAX_CATEGORY_NAME = "Impostos e taxas";

export async function loadRegularityScore(organizationId: string, today: Date = new Date()): Promise<RegularityScore> {
  const profile = await getOrCreateTaxProfile(organizationId);
  const overrides = await loadRequirementOverrides(organizationId);
  const applicabilityProfile = toApplicabilityProfile(profile);

  const documents = await prisma.companyDocument.findMany({
    where: { organizationId },
    select: { id: true, typeCode: true, issuedAt: true, expiresAt: true, period: true, createdAt: true, status: true },
  });

  const periods = listEvaluatedPeriods(profile.onboardingCompletedAt ?? profile.createdAt, today);
  const monthlyFulfillments = await buildMonthlyFulfillments({
    organizationId,
    profile: applicabilityProfile,
    overrides,
    periods,
    documents,
  });

  return computeRegularityScore({
    profile: applicabilityProfile,
    overrides,
    documents,
    monthlyFulfillments,
    today,
  });
}

/** Meses fechados avaliados: até 3, nunca antes do onboarding fiscal. */
function listEvaluatedPeriods(trackingStart: Date, today: Date): string[] {
  const startMonth = toMonthKey(trackingStart);
  const lastClosedMonth = shiftMonthKey(toMonthKey(today), -1);
  const periods: string[] = [];
  for (let offset = MONTHS_EVALUATED - 1; offset >= 0; offset -= 1) {
    const monthKey = shiftMonthKey(lastClosedMonth, -offset);
    if (monthKey >= startMonth) periods.push(monthKey);
  }
  return periods;
}

async function buildMonthlyFulfillments(params: {
  organizationId: string;
  profile: ApplicabilityProfile;
  overrides: RequirementOverride[];
  periods: string[];
  documents: Array<{ typeCode: string; period: string | null; status: string }>;
}): Promise<MonthlyFulfillment[]> {
  if (params.periods.length === 0) return [];
  const overridesByCode = new Map(params.overrides.map((override) => [override.typeCode, override]));
  const monthlyTypes = COMPANY_DOCUMENT_TYPES.filter(
    (documentType) =>
      documentType.recurrence === "MONTHLY" &&
      isDocumentApplicable(documentType, params.profile, overridesByCode.get(documentType.code)),
  );

  const obligations = await prisma.fiscalObligation.findMany({
    where: {
      organizationId: params.organizationId,
      period: { in: params.periods },
      kind: { in: monthlyTypes.map((documentType) => documentType.code) },
    },
    select: { kind: true, period: true, status: true, dueDate: true },
  });
  const obligationByKey = new Map(obligations.map((obligation) => [`${obligation.kind}:${obligation.period}`, obligation]));
  const documentKeys = new Set(
    params.documents
      .filter((document) => document.period && document.status !== "REPLACED")
      .map((document) => `${document.typeCode}:${document.period}`),
  );

  const invoiceCoverage = await loadInvoiceCoverage(params.organizationId, params.periods);
  const fulfillments: MonthlyFulfillment[] = [];

  for (const documentType of monthlyTypes) {
    for (const period of params.periods) {
      const key = `${documentType.code}:${period}`;
      const obligation = obligationByKey.get(key);
      const { year, month } = parseMonthKey(shiftMonthKey(period, 1));
      const dueDate = obligation?.dueDate ?? new Date(Date.UTC(year, month - 1, documentType.dueDay ?? 20, 23));

      let isFulfilled = documentKeys.has(key) || obligation?.status === "DONE" || obligation?.status === "NOT_APPLICABLE";
      if (!isFulfilled && documentType.code === "NOTAS_EMITIDAS_MES") {
        isFulfilled = invoiceCoverage.issuedByPeriod.get(period) ?? true;
      }
      if (!isFulfilled && documentType.code === "NOTAS_ENTRADA_MES") {
        isFulfilled = invoiceCoverage.receivedByPeriod.get(period) ?? true;
      }
      fulfillments.push({ typeCode: documentType.code, period, dueDate, isFulfilled });
    }
  }
  return fulfillments;
}

/**
 * Notas do mês: toda receita da competência tem nota anexada, e toda despesa
 * paga no mês (exceto guias de imposto) tem nota ou recibo.
 */
async function loadInvoiceCoverage(organizationId: string, periods: string[]) {
  const issuedByPeriod = new Map<string, boolean>();
  const receivedByPeriod = new Map<string, boolean>();

  for (const period of periods) {
    const start = new Date(`${period}-01T00:00:00Z`);
    const end = new Date(`${shiftMonthKey(period, 1)}-01T00:00:00Z`);

    const receivablesWithoutInvoice = await prisma.paymentEntry.count({
      where: {
        organizationId,
        type: "RECEIVABLE",
        status: { notIn: ["CANCELLED", "PENDING_APPROVAL"] },
        OR: [
          { competenceDate: { gte: start, lt: end } },
          { competenceDate: null, dueDate: { gte: start, lt: end } },
        ],
        attachments: { none: { kind: "NOTA_FISCAL" } },
      },
    });
    issuedByPeriod.set(period, receivablesWithoutInvoice === 0);

    const payablesWithoutInvoice = await prisma.paymentEntry.count({
      where: {
        organizationId,
        type: "PAYABLE",
        status: "PAID",
        paidAt: { gte: start, lt: end },
        NOT: { category: { name: TAX_CATEGORY_NAME } },
        attachments: { none: { kind: { in: ["NOTA_FISCAL", "RECIBO"] } } },
      },
    });
    receivedByPeriod.set(period, payablesWithoutInvoice === 0);
  }

  return { issuedByPeriod, receivedByPeriod };
}

/** Grava o snapshot diário (idempotente por data). */
export async function snapshotRegularityScore(organizationId: string, today: Date = new Date()) {
  const score = await loadRegularityScore(organizationId, today);
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const breakdown = JSON.parse(
    JSON.stringify(
      score.items.map((item) => ({ typeCode: item.typeCode, status: item.status, weight: item.weight, openPeriods: item.openPeriods })),
    ),
  );
  await prisma.regularityScoreSnapshot.upsert({
    where: { organizationId_date: { organizationId, date } },
    create: { organizationId, date, scoreBps: score.scoreBps, breakdown },
    update: { scoreBps: score.scoreBps, breakdown },
  });
  return score;
}
