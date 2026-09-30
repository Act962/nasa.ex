import type { DocumentScope } from "@/features/accounting/lib/compliance/document-catalog";
import { formatPeriodLabel } from "@/features/accounting/lib/profile/tax-display";

// Rótulos e formatação da subaba de documentos (cliente).

export const CUSTOM_DOCUMENT_TYPE = "CUSTOM";
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export type RegularityStatus = "OK" | "EXPIRING_SOON" | "MISSING" | "EXPIRED" | "OVERDUE";
export type DocumentDisplayStatus = "VALID" | "EXPIRING_SOON" | "EXPIRED" | "PENDING_REVIEW" | "REPLACED";

export const DOCUMENT_STATUS_LABELS: Record<DocumentDisplayStatus, string> = {
  VALID: "Em dia",
  EXPIRING_SOON: "Vence logo",
  EXPIRED: "Vencido",
  PENDING_REVIEW: "Revisar dados",
  REPLACED: "Substituído",
};

export const DOCUMENT_STATUS_CLASSES: Record<DocumentDisplayStatus, string> = {
  VALID: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  EXPIRING_SOON: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  EXPIRED: "bg-red-500/10 text-red-700 dark:text-red-300",
  PENDING_REVIEW: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  REPLACED: "bg-muted text-muted-foreground",
};

export const SCOPE_ORDER: DocumentScope[] = [
  "FEDERAL",
  "ESTADUAL",
  "MUNICIPAL",
  "TRABALHISTA",
  "SOCIETARIO",
  "FISCAL_CONTABIL",
];

/** Datas de documento ficam ao meio-dia UTC: formatar em UTC evita "voltar" um dia. */
export function formatDocumentDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

/** Date → "AAAA-MM-DD" para `<input type="date">`. */
export function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

export function formatOpenPeriods(periods: string[]): string {
  return periods.map((period) => formatPeriodLabel(period)).join(", ");
}

export function describeRegularityReason(item: {
  status: RegularityStatus;
  daysToExpire: number | null;
  openPeriods: string[];
}): string {
  switch (item.status) {
    case "EXPIRED": {
      const daysLate = Math.abs(item.daysToExpire ?? 0);
      return daysLate === 0 ? "Venceu hoje" : `Vencido há ${daysLate} ${daysLate === 1 ? "dia" : "dias"}`;
    }
    case "EXPIRING_SOON": {
      const daysLeft = item.daysToExpire ?? 0;
      return daysLeft === 0 ? "Vence hoje" : `Vence em ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`;
    }
    case "MISSING":
      return "Ainda não foi enviado";
    case "OVERDUE":
      return `Meses em aberto: ${formatOpenPeriods(item.openPeriods)}`;
    default:
      return "Em dia";
  }
}

export function formatScorePercent(scoreBps: number): number {
  return Math.round(scoreBps / 100);
}

/** Faixa de cor do score: verde ≥ 85%, âmbar ≥ 60%, vermelho abaixo. */
export function scoreTone(scorePercent: number) {
  if (scorePercent >= 85) {
    return { stroke: "stroke-emerald-500", text: "text-emerald-600 dark:text-emerald-400", hex: "#10b981", label: "Em dia" };
  }
  if (scorePercent >= 60) {
    return { stroke: "stroke-amber-500", text: "text-amber-600 dark:text-amber-400", hex: "#f59e0b", label: "Atenção" };
  }
  return { stroke: "stroke-red-500", text: "text-red-600 dark:text-red-400", hex: "#ef4444", label: "Risco" };
}

export function astroPromptForDocument(label: string, reason: string): string {
  return `Minha empresa fica em Teresina (PI). Como faço para obter ou renovar o documento "${label}"? Situação atual: ${reason}. Me diga o site oficial, o passo a passo, o que preciso ter em mãos, custo e prazo, e o que acontece se eu ficar sem ele.`;
}
