import { parseMonthKey, shiftMonthKey } from "../format";
import {
  COMPANY_DOCUMENT_TYPES,
  isDocumentApplicable,
  type ApplicabilityProfile,
  type RequirementOverride,
} from "../compliance/document-catalog";

export interface PlannedObligation {
  kind: string;
  label: string;
  /** "AAAA-MM" (competência mensal) ou "AAAA" (anual). */
  period: string;
  dueDate: Date;
}

const OBLIGATION_GROUPS = new Set(["GUIAS", "DECLARACOES", "LIVROS"]);

/**
 * Obrigações de um intervalo de competências. Mensais vencem no mês seguinte
 * ao da competência; anuais, no ano seguinte ao exercício. Vencimento em fim
 * de semana antecipa para a sexta (regra dos tributos federais).
 */
export function buildFiscalCalendar(params: {
  profile: ApplicabilityProfile;
  overrides: RequirementOverride[];
  fromMonth: string;
  toMonth: string;
}): PlannedObligation[] {
  const overridesByCode = new Map(params.overrides.map((override) => [override.typeCode, override]));
  const planned: PlannedObligation[] = [];
  const months = listMonths(params.fromMonth, params.toMonth);

  for (const documentType of COMPANY_DOCUMENT_TYPES) {
    if (!OBLIGATION_GROUPS.has(documentType.group)) continue;
    if (!documentType.dueDay) continue;
    if (!isDocumentApplicable(documentType, params.profile, overridesByCode.get(documentType.code))) continue;

    if (documentType.recurrence === "MONTHLY") {
      for (const monthKey of months) {
        const { year, month } = parseMonthKey(shiftMonthKey(monthKey, 1));
        planned.push({
          kind: documentType.code,
          label: documentType.label,
          period: monthKey,
          dueDate: adjustToBusinessDay(new Date(Date.UTC(year, month - 1, clampDay(year, month, documentType.dueDay), 12))),
        });
      }
    }

    if (documentType.recurrence === "ANNUAL" && documentType.dueMonth) {
      const years = new Set(months.map((monthKey) => parseMonthKey(monthKey).year));
      for (const dueYear of years) {
        const referenceYear = dueYear - 1;
        const dueDate = adjustToBusinessDay(
          new Date(Date.UTC(dueYear, documentType.dueMonth - 1, clampDay(dueYear, documentType.dueMonth, documentType.dueDay), 12)),
        );
        const dueMonthKey = `${dueYear}-${String(documentType.dueMonth).padStart(2, "0")}`;
        if (dueMonthKey < params.fromMonth || dueMonthKey > shiftMonthKey(params.toMonth, 1)) continue;
        planned.push({
          kind: documentType.code,
          label: `${documentType.label} — exercício ${referenceYear}`,
          period: String(referenceYear),
          dueDate,
        });
      }
    }
  }

  return planned.sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime());
}

function listMonths(fromMonth: string, toMonth: string): string[] {
  const months: string[] = [];
  let cursor = fromMonth;
  while (cursor <= toMonth && months.length < 60) {
    months.push(cursor);
    cursor = shiftMonthKey(cursor, 1);
  }
  return months;
}

function clampDay(year: number, month: number, day: number): number {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.min(day, lastDay);
}

function adjustToBusinessDay(date: Date): Date {
  const weekday = date.getUTCDay();
  if (weekday === 6) return new Date(date.getTime() - 86_400_000);
  if (weekday === 0) return new Date(date.getTime() - 2 * 86_400_000);
  return date;
}
