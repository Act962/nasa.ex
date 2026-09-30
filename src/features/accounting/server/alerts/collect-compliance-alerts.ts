import "server-only";

import prisma from "@/lib/prisma";
import type { Severity } from "@/features/alerts/lib/severity";
import type { ComplianceItemKind } from "@/features/workflows/lib/agent-trigger-helpers";
import { formatBps, formatCentsBrl, shiftMonthKey } from "@/features/accounting/lib/format";
import { findDocumentType } from "@/features/accounting/lib/compliance/document-catalog";
import { syncFiscalObligations } from "@/features/accounting/server/obligations/sync-fiscal-obligations";
import { loadRegularityScore } from "@/features/accounting/server/compliance/load-regularity";

// Decide o que avisar hoje para uma org (spec 0051, RF-16). Cada condição
// casa num único dia (5/2/0 dias antes, 1º–3º dia de atraso, dia 10, segunda),
// então o cron diário não repete aviso por conta própria.

export const COMPLIANCE_ALERT_EVENTS = [
  "accounting.obligation_due_soon",
  "accounting.obligation_overdue",
  "accounting.assessment_ready",
  "accounting.credit_missing_invoice",
  "accounting.document_expiring",
  "accounting.document_expired",
  "accounting.regularity_score_dropped",
] as const;
export type ComplianceAlertEvent = (typeof COMPLIANCE_ALERT_EVENTS)[number];

const OBLIGATION_DAYS_BEFORE = [5, 2, 0];
const OVERDUE_ALERT_DAYS = 3;
const DOCUMENT_DAYS_BEFORE = [30, 15, 5];
const RECENTLY_EXPIRED_DAYS = 7;
const ASSESSMENT_REMINDER_DAY = 10;
const MONDAY = 1;
const SCORE_DROP_THRESHOLD_BPS = 500;
const SCORE_COMPARISON_DAYS = 7;
const SNAPSHOT_TOLERANCE_DAYS = 3;
const TAX_CATEGORY_NAME = "Impostos e taxas";
const DAY_MS = 86_400_000;

export interface BusinessDay {
  /** AAAA-MM-DD em São Paulo. */
  dayKey: string;
  monthKey: string;
  dayOfMonth: number;
  weekday: number;
  /** AAAA-Www (semana ISO). */
  weekKey: string;
}

export interface ComplianceTriggerItem {
  itemKind: ComplianceItemKind;
  code: string;
  label: string;
  dueDate: string;
  daysBefore: number;
  amountCents: number | null;
}

export interface ComplianceAlertCandidate {
  eventType: ComplianceAlertEvent;
  payload: Record<string, unknown> & { orgId: string; label: string; actionUrl: string };
  severity: Severity;
  title: string;
  body: string;
  /** Linha curta do resumo no WhatsApp. */
  whatsappLine: string;
  dueDateLabel: string;
  amountLabel: string;
  trigger: ComplianceTriggerItem | null;
}

const BUSINESS_TIMEZONE = "America/Sao_Paulo";

export function resolveBusinessDay(now: Date = new Date()): BusinessDay {
  const dayKey = now.toLocaleDateString("en-CA", { timeZone: BUSINESS_TIMEZONE });
  const calendarDate = new Date(`${dayKey}T12:00:00Z`);
  return {
    dayKey,
    monthKey: dayKey.slice(0, 7),
    dayOfMonth: calendarDate.getUTCDate(),
    weekday: calendarDate.getUTCDay(),
    weekKey: toIsoWeekKey(calendarDate),
  };
}

function toIsoWeekKey(calendarDate: Date): string {
  const thursday = new Date(calendarDate.getTime());
  thursday.setUTCDate(thursday.getUTCDate() + 3 - ((thursday.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const weekNumber =
    1 + Math.round(((thursday.getTime() - firstThursday.getTime()) / DAY_MS - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${thursday.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysBetween(fromDayKey: string, toDayKey: string): number {
  return Math.round((Date.parse(`${toDayKey}T00:00:00Z`) - Date.parse(`${fromDayKey}T00:00:00Z`)) / DAY_MS);
}

function formatDayKey(dayKey: string): string {
  const [year, month, day] = dayKey.split("-");
  return `${day}/${month}/${year}`;
}

function formatPeriod(period: string): string {
  const [year, month] = period.split("-");
  return month ? `${month}/${year}` : period;
}

function describeDaysLeft(daysBefore: number): string {
  if (daysBefore === 0) return "vence hoje";
  if (daysBefore === 1) return "vence amanhã";
  return `vence em ${daysBefore} dias`;
}

function describeDaysOverdue(daysOverdue: number): string {
  return daysOverdue === 1 ? "venceu ontem" : `venceu há ${daysOverdue} dias`;
}

export async function collectComplianceAlerts(
  organizationId: string,
  today: BusinessDay,
  now: Date = new Date(),
): Promise<ComplianceAlertCandidate[]> {
  await syncFiscalObligations(organizationId, now);

  const candidates: ComplianceAlertCandidate[] = [
    ...(await collectObligationAlerts(organizationId, today)),
    ...(await collectAssessmentAlert(organizationId, today)),
    ...(await collectMissingInvoiceAlert(organizationId, today, now)),
  ];

  const score = await loadRegularityScore(organizationId, now);
  candidates.push(...collectDocumentAlerts(organizationId, score.items, now));
  candidates.push(...(await collectScoreDropAlert(organizationId, today, score.scoreBps)));
  return candidates;
}

async function collectObligationAlerts(organizationId: string, today: BusinessDay): Promise<ComplianceAlertCandidate[]> {
  const windowStart = new Date(Date.parse(`${today.dayKey}T00:00:00Z`) - (OVERDUE_ALERT_DAYS + 1) * DAY_MS);
  const windowEnd = new Date(Date.parse(`${today.dayKey}T00:00:00Z`) + (Math.max(...OBLIGATION_DAYS_BEFORE) + 1) * DAY_MS);
  const obligations = await prisma.fiscalObligation.findMany({
    where: {
      organizationId,
      status: { in: ["PENDING", "OVERDUE"] },
      dueDate: { gte: windowStart, lt: windowEnd },
    },
    include: { assessment: { select: { amountCents: true } } },
    orderBy: { dueDate: "asc" },
  });

  const candidates: ComplianceAlertCandidate[] = [];
  for (const obligation of obligations) {
    const dueDayKey = toDayKey(obligation.dueDate);
    const daysBefore = daysBetween(today.dayKey, dueDayKey);
    const typeLabel = findDocumentType(obligation.kind)?.label ?? obligation.kind;
    const label = `${typeLabel} — ${formatPeriod(obligation.period)}`;
    const amountCents = obligation.assessment?.amountCents ?? null;
    const amountLabel = amountCents !== null && amountCents > 0 ? formatCentsBrl(amountCents) : "";
    const amountSuffix = amountLabel ? ` Valor: ${amountLabel}.` : "";
    const trigger: ComplianceTriggerItem = {
      itemKind: "OBLIGATION",
      code: obligation.kind,
      label,
      dueDate: dueDayKey,
      daysBefore,
      amountCents,
    };

    if (OBLIGATION_DAYS_BEFORE.includes(daysBefore)) {
      const whenText = describeDaysLeft(daysBefore);
      candidates.push({
        eventType: "accounting.obligation_due_soon",
        payload: {
          orgId: organizationId,
          label,
          obligationId: obligation.id,
          kind: obligation.kind,
          period: obligation.period,
          dueDate: dueDayKey,
          daysBefore,
          amountCents,
          actionUrl: "/payment?tab=accounting&sub=calendar",
        },
        severity: daysBefore === 0 ? "warning" : "info",
        title: daysBefore === 0 ? `${typeLabel} vence hoje` : `${typeLabel} ${whenText}`,
        body: `${label} ${whenText} (${formatDayKey(dueDayKey)}).${amountSuffix}`,
        whatsappLine: `${label}: ${whenText} (${formatDayKey(dueDayKey)})${amountLabel ? ` — ${amountLabel}` : ""}`,
        dueDateLabel: formatDayKey(dueDayKey),
        amountLabel,
        trigger,
      });
    }

    const daysOverdue = -daysBefore;
    if (daysOverdue >= 1 && daysOverdue <= OVERDUE_ALERT_DAYS) {
      const whenText = describeDaysOverdue(daysOverdue);
      candidates.push({
        eventType: "accounting.obligation_overdue",
        payload: {
          orgId: organizationId,
          label,
          obligationId: obligation.id,
          kind: obligation.kind,
          period: obligation.period,
          dueDate: dueDayKey,
          daysOverdue,
          dayKey: today.dayKey,
          amountCents,
          actionUrl: "/payment?tab=accounting&sub=calendar",
        },
        severity: "warning",
        title: `${typeLabel} vencido`,
        body: `${label} ${whenText} (${formatDayKey(dueDayKey)}). Pague ou anexe o comprovante para evitar multa e juros.${amountSuffix}`,
        whatsappLine: `${label}: ${whenText} (${formatDayKey(dueDayKey)})${amountLabel ? ` — ${amountLabel}` : ""}`,
        dueDateLabel: formatDayKey(dueDayKey),
        amountLabel,
        trigger,
      });
    }
  }
  return candidates;
}

async function collectAssessmentAlert(organizationId: string, today: BusinessDay): Promise<ComplianceAlertCandidate[]> {
  if (today.dayOfMonth !== ASSESSMENT_REMINDER_DAY) return [];
  const period = shiftMonthKey(today.monthKey, -1);
  const assessments = await prisma.taxAssessment.findMany({
    where: { organizationId, period, status: { not: "CANCELLED" } },
    select: { status: true, amountCents: true, dueDate: true },
  });
  const isConfirmed = assessments.some((assessment) => assessment.status === "CONFIRMED" || assessment.status === "PAID");
  if (isConfirmed) return [];

  const draftTotalCents = assessments.reduce((total, assessment) => total + assessment.amountCents, 0);
  const earliestDueDate = assessments
    .map((assessment) => assessment.dueDate)
    .filter((dueDate): dueDate is Date => dueDate !== null)
    .sort((left, right) => left.getTime() - right.getTime())[0];
  const dueDayKey = earliestDueDate ? toDayKey(earliestDueDate) : null;
  const amountCents = assessments.length > 0 ? draftTotalCents : null;
  const amountLabel = amountCents !== null && amountCents > 0 ? formatCentsBrl(amountCents) : "";
  const label = `Imposto de ${formatPeriod(period)}`;
  const body =
    assessments.length > 0
      ? `A apuração de ${formatPeriod(period)} está pronta para conferir${amountLabel ? ` (${amountLabel})` : ""}. Confirme para gerar a guia.`
      : `O imposto de ${formatPeriod(period)} ainda não foi calculado. Abra a aba Contábil e clique em apurar.`;

  return [
    {
      eventType: "accounting.assessment_ready",
      payload: {
        orgId: organizationId,
        label,
        period,
        ...(dueDayKey ? { dueDate: dueDayKey } : {}),
        amountCents,
        actionUrl: "/payment?tab=accounting&sub=assessments",
      },
      severity: "info",
      title: `Confira o imposto de ${formatPeriod(period)}`,
      body,
      whatsappLine: `${label}: conferir e gerar a guia${amountLabel ? ` — ${amountLabel}` : ""}`,
      dueDateLabel: dueDayKey ? formatDayKey(dueDayKey) : "",
      amountLabel,
      trigger: {
        itemKind: "ASSESSMENT",
        code: "ASSESSMENT",
        label,
        dueDate: dueDayKey ?? today.dayKey,
        daysBefore: dueDayKey ? daysBetween(today.dayKey, dueDayKey) : 0,
        amountCents,
      },
    },
  ];
}

async function collectMissingInvoiceAlert(
  organizationId: string,
  today: BusinessDay,
  now: Date,
): Promise<ComplianceAlertCandidate[]> {
  if (today.weekday !== MONDAY) return [];
  const since = new Date(now.getTime() - 7 * DAY_MS);
  const entries = await prisma.paymentEntry.findMany({
    where: {
      organizationId,
      type: "PAYABLE",
      status: "PAID",
      paidAt: { gte: since, lte: now },
      NOT: { category: { name: TAX_CATEGORY_NAME } },
      attachments: { none: { kind: { in: ["NOTA_FISCAL", "RECIBO"] } } },
    },
    select: { amount: true },
  });
  if (entries.length === 0) return [];

  const totalCents = entries.reduce((total, entry) => total + entry.amount, 0);
  const plural = entries.length === 1 ? "despesa paga" : "despesas pagas";
  const label = `${entries.length} ${plural} sem nota`;
  const amountLabel = formatCentsBrl(totalCents);
  return [
    {
      eventType: "accounting.credit_missing_invoice",
      payload: {
        orgId: organizationId,
        label,
        weekKey: today.weekKey,
        missingCount: entries.length,
        totalCents,
        actionUrl: "/payment?tab=accounting&sub=credits",
      },
      severity: "info",
      title: "Despesas sem nota na semana",
      body: `${label} na última semana (${amountLabel}). Sem a nota, o crédito de IBS/CBS se perde. Anexe a nota em cada lançamento.`,
      whatsappLine: `${label} na semana (${amountLabel}) — anexe as notas para não perder crédito`,
      dueDateLabel: "",
      amountLabel,
      trigger: {
        itemKind: "INVOICE_MONTH",
        code: "NOTAS_ENTRADA_MES",
        label,
        dueDate: today.dayKey,
        daysBefore: 0,
        amountCents: totalCents,
      },
    },
  ];
}

interface ScoreItemForAlert {
  typeCode: string;
  label: string;
  status: string;
  expiresAt: Date | null;
  daysToExpire: number | null;
  documentId: string | null;
  blockingImpact: string | null;
}

function collectDocumentAlerts(organizationId: string, items: ScoreItemForAlert[], now: Date): ComplianceAlertCandidate[] {
  const candidates: ComplianceAlertCandidate[] = [];
  for (const item of items) {
    if (!item.expiresAt || item.daysToExpire === null) continue;
    const expiresDayKey = toDayKey(item.expiresAt);

    if (item.status === "EXPIRING_SOON" && DOCUMENT_DAYS_BEFORE.includes(item.daysToExpire)) {
      const whenText = `vence em ${item.daysToExpire} dias`;
      candidates.push({
        eventType: "accounting.document_expiring",
        payload: {
          orgId: organizationId,
          label: item.label,
          typeCode: item.typeCode,
          documentId: item.documentId,
          expiresAt: expiresDayKey,
          daysBefore: item.daysToExpire,
          actionUrl: "/payment?tab=accounting&sub=documents",
        },
        severity: "info",
        title: `${item.label} ${whenText}`,
        body: `${item.label} ${whenText} (${formatDayKey(expiresDayKey)}). Emita a nova via e anexe na aba Contábil.`,
        whatsappLine: `${item.label}: ${whenText} (${formatDayKey(expiresDayKey)})`,
        dueDateLabel: formatDayKey(expiresDayKey),
        amountLabel: "",
        trigger: {
          itemKind: "DOCUMENT",
          code: item.typeCode,
          label: item.label,
          dueDate: expiresDayKey,
          daysBefore: item.daysToExpire,
          amountCents: null,
        },
      });
    }

    const daysSinceExpired = Math.floor((now.getTime() - item.expiresAt.getTime()) / DAY_MS);
    if (item.status === "EXPIRED" && daysSinceExpired <= RECENTLY_EXPIRED_DAYS) {
      const impactSuffix = item.blockingImpact ? ` ${item.blockingImpact}` : "";
      candidates.push({
        eventType: "accounting.document_expired",
        payload: {
          orgId: organizationId,
          label: item.label,
          typeCode: item.typeCode,
          documentId: item.documentId,
          expiresAt: expiresDayKey,
          blockingImpact: item.blockingImpact,
          actionUrl: "/payment?tab=accounting&sub=documents",
        },
        severity: "warning",
        title: `${item.label} vencido`,
        body: `${item.label} venceu em ${formatDayKey(expiresDayKey)}.${impactSuffix} Emita a nova via e anexe na aba Contábil.`,
        whatsappLine: `${item.label}: vencido desde ${formatDayKey(expiresDayKey)}`,
        dueDateLabel: formatDayKey(expiresDayKey),
        amountLabel: "",
        trigger: {
          itemKind: "DOCUMENT",
          code: item.typeCode,
          label: item.label,
          dueDate: expiresDayKey,
          daysBefore: Math.min(-1, -daysSinceExpired),
          amountCents: null,
        },
      });
    }
  }
  return candidates;
}

async function collectScoreDropAlert(
  organizationId: string,
  today: BusinessDay,
  currentScoreBps: number,
): Promise<ComplianceAlertCandidate[]> {
  const comparisonDate = new Date(Date.parse(`${today.dayKey}T00:00:00Z`) - SCORE_COMPARISON_DAYS * DAY_MS);
  const previousSnapshot = await prisma.regularityScoreSnapshot.findFirst({
    where: {
      organizationId,
      date: {
        lte: comparisonDate,
        gte: new Date(comparisonDate.getTime() - SNAPSHOT_TOLERANCE_DAYS * DAY_MS),
      },
    },
    orderBy: { date: "desc" },
    select: { scoreBps: true },
  });
  if (!previousSnapshot) return [];
  const dropBps = previousSnapshot.scoreBps - currentScoreBps;
  if (dropBps < SCORE_DROP_THRESHOLD_BPS) return [];

  const label = "Score de regularidade";
  const scoreText = `${formatBps(previousSnapshot.scoreBps, 0)} → ${formatBps(currentScoreBps, 0)}`;
  return [
    {
      eventType: "accounting.regularity_score_dropped",
      payload: {
        orgId: organizationId,
        label,
        weekKey: today.weekKey,
        previousScoreBps: previousSnapshot.scoreBps,
        currentScoreBps,
        actionUrl: "/payment?tab=accounting&sub=documents",
      },
      severity: "warning",
      title: "O score de regularidade caiu",
      body: `Seu score de regularidade caiu de ${scoreText} na última semana. Veja o que está pendente na aba Contábil.`,
      whatsappLine: `Score de regularidade caiu: ${scoreText}`,
      dueDateLabel: formatDayKey(today.dayKey),
      amountLabel: "",
      trigger: null,
    },
  ];
}
