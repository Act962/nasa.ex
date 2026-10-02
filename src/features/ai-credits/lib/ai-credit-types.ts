/** Tipos compartilhados entre servidor e telas dos créditos de IA (spec 0055). */

export const AI_CREDIT_PROVIDERS = ["openai", "google", "anthropic"] as const;
export type AiCreditProvider = (typeof AI_CREDIT_PROVIDERS)[number];

export const AI_CREDIT_PROVIDER_LABELS: Record<AiCreditProvider, string> = {
  openai: "OpenAI",
  google: "Gemini (Google)",
  anthropic: "Anthropic",
};

export type AiCreditLevel = "unknown" | "free" | "ok" | "warning" | "critical";

export interface AiCreditProviderSummary {
  provider: AiCreditProvider;
  /** Saldo estimado em US$; nulo quando nunca houve lançamento (CB-1). */
  balanceUsd: number | null;
  /** Último saldo informado + recargas depois dele: base do percentual. */
  referenceUsd: number | null;
  remainingPercent: number | null;
  spentSinceReferenceUsd: number;
  /** Tokens gastos desde o último saldo informado (ou da primeira recarga). */
  tokensSinceReference: number;
  spendTodayUsd: number;
  spend7dUsd: number;
  spend30dUsd: number;
  dailyBurnUsd: number;
  daysLeft: number | null;
  tokens30d: number;
  level: AiCreditLevel;
  lastEntryAt: string | null;
  /** Início da conta do saldo atual (último saldo informado ou primeira recarga). */
  referenceStartAt: string | null;
}

export interface AiCreditEntryView {
  id: string;
  provider: AiCreditProvider;
  kind: "TOPUP" | "BALANCE_SNAPSHOT" | "FREE_TIER";
  amountUsd: number;
  effectiveAt: string;
  note: string | null;
}

export interface AiCreditsOverview {
  isLedgerAvailable: boolean;
  providers: AiCreditProviderSummary[];
  entries: AiCreditEntryView[];
}

export const AI_CREDIT_WARNING_PERCENT = 30;
export const AI_CREDIT_CRITICAL_PERCENT = 10;
export const AI_CREDIT_CRITICAL_DAYS = 7;
