// Rótulos e termos do glossário para a interface. Espelha o TAX_LABELS do
// servidor (que é server-only e não pode ir para o bundle do cliente).

export type TaxKindDisplay =
  | "DAS" | "DAS_MEI" | "IRPJ" | "CSLL" | "PIS" | "COFINS" | "ISS" | "ICMS" | "CBS" | "IBS" | "IS" | "INSS" | "FGTS" | "IRRF";

export type TaxRegimeDisplay = "MEI" | "SIMPLES" | "PRESUMIDO" | "REAL";

export const TAX_DISPLAY_LABELS: Record<TaxKindDisplay, string> = {
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

export const TAX_TERM_IDS: Partial<Record<TaxKindDisplay, string>> = {
  DAS: "das",
  DAS_MEI: "das-mei",
  IRPJ: "lucro-presumido",
  CSLL: "lucro-presumido",
  PIS: "pis-cofins",
  COFINS: "pis-cofins",
  ISS: "iss",
  ICMS: "icms",
  CBS: "cbs",
  IBS: "ibs",
  IS: "is",
  IRRF: "irrf",
};

export const REGIME_LABELS: Record<TaxRegimeDisplay, string> = {
  MEI: "MEI",
  SIMPLES: "Simples Nacional",
  PRESUMIDO: "Lucro Presumido",
  REAL: "Lucro Real",
};

export const REGIME_TERM_IDS: Record<TaxRegimeDisplay, string> = {
  MEI: "mei",
  SIMPLES: "simples-nacional",
  PRESUMIDO: "lucro-presumido",
  REAL: "lucro-real",
};

export const TEST_YEAR_REFORM = 2026;

/** "2026-09" → "set/2026"; "2026-T3" → "3º tri/2026". */
export function formatPeriodLabel(period: string): string {
  const quarterMatch = /^(\d{4})-T(\d)$/.exec(period);
  if (quarterMatch) return `${quarterMatch[2]}º tri/${quarterMatch[1]}`;
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(period);
  if (!monthMatch) return period;
  const monthDate = new Date(Date.UTC(Number(monthMatch[1]), Number(monthMatch[2]) - 1, 15));
  const monthName = monthDate.toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "");
  return `${monthName}/${monthMatch[1]}`;
}

/** Datas fiscais são gravadas ao meio-dia UTC: formata no calendário UTC para não "voltar" um dia. */
export function formatFiscalDate(date: Date, withYear = false): string {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

/** Dias entre hoje (calendário local) e a data fiscal (calendário UTC). Negativo = já passou. */
export function daysUntilFiscalDate(date: Date, today: Date = new Date()): number {
  const dueDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((dueDay - todayDay) / 86_400_000);
}

export function describeDaysUntil(days: number): string {
  if (days === 0) return "vence hoje";
  if (days === 1) return "vence amanhã";
  if (days > 1) return `faltam ${days} dias`;
  if (days === -1) return "venceu ontem";
  return `venceu há ${Math.abs(days)} dias`;
}

/** Mês anterior ao de hoje no formato "AAAA-MM" (calendário local). */
export function previousMonthKey(today: Date = new Date()): string {
  const previous = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;
}
