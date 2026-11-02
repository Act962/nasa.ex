import type { TrafegoOrderStatus } from "@/generated/prisma/enums";
import { TRAFEGO_SERVICE_FEE_PERCENT } from "../pricing-tiers";
import { MAX_AGE, MIN_AGE, MIN_RADIUS_KM, type AudienceDraft } from "./build-meta-payloads";

/** Regras puras do construtor de campanha (spec 0124). Sem rede: o script de QA testa direto. */

/** Status do pedido em que o owner/admin pode criar e publicar (RF-1). */
export const CAMPAIGN_BUILDER_ORDER_STATUSES: readonly TrafegoOrderStatus[] = [
  "ONBOARDING",
  "MATERIALS_SUBMITTED",
  "REQUESTED",
  "CHANGES_REQUESTED",
  "SCHEDULED",
  "RUNNING",
  "PAUSED",
];

export type CampaignBuilderBlockReason =
  | "not_owner_or_admin"
  | "not_meta"
  | "no_integration"
  | "cannot_create"
  | "order_status"
  | "overdue_complement"
  | "meta_unavailable";

export const CAMPAIGN_BUILDER_BLOCK_MESSAGE: Record<CampaignBuilderBlockReason, string> = {
  not_owner_or_admin: "Só o dono ou um administrador da empresa cria e publica campanhas.",
  not_meta: "A criação pelo painel vale só para campanhas no Meta (Facebook e Instagram).",
  no_integration: "Conecte a conta de anúncios da Meta nos Satélites para criar campanhas por aqui.",
  cannot_create:
    "A conexão com a Meta não tem permissão para criar anúncios. Teste a conexão nos Satélites e veja o que falta.",
  order_status: "Esta campanha não está numa fase em que dá para criar ou publicar anúncios.",
  overdue_complement: "Há um complemento da taxa vencido. Depois do pagamento, a criação volta a funcionar.",
  meta_unavailable: "Não foi possível falar com a Meta agora. Tente de novo em alguns minutos.",
};

export function isCampaignBuilderStatus(status: TrafegoOrderStatus): boolean {
  return CAMPAIGN_BUILDER_ORDER_STATUSES.includes(status);
}

export interface BudgetComplementEstimate {
  remainingDeclaredBrlCents: number;
  excessBrlCents: number;
  estimatedComplementBrlCents: number;
  needsConfirmation: boolean;
}

/** Verba acima do saldo declarado gera complemento de 30% do excedente (spec 0123); pede confirmação (CA-11). */
export function estimateBudgetComplement(params: {
  budgetBrlCents: number;
  declaredBudgetBrlCents: number;
  spentBrlCents: number;
}): BudgetComplementEstimate {
  const remainingDeclaredBrlCents = Math.max(0, params.declaredBudgetBrlCents - params.spentBrlCents);
  const excessBrlCents = Math.max(0, params.budgetBrlCents - remainingDeclaredBrlCents);
  return {
    remainingDeclaredBrlCents,
    excessBrlCents,
    estimatedComplementBrlCents: Math.round((excessBrlCents * TRAFEGO_SERVICE_FEE_PERCENT) / 100),
    needsConfirmation: excessBrlCents > 0,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Dias de veiculação de hoje até o fim, contando os dois (mínimo 1). Datas `AAAA-MM-DD`. */
export function countCampaignDays(todayDate: string, endDate: string): number {
  const days = Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${todayDate}T00:00:00Z`)) / DAY_MS) + 1;
  return Math.max(1, days);
}

/** A verba diária equivalente não pode ficar abaixo do mínimo da conta (RF-6). */
export function isBelowMinDailyBudget(params: {
  budgetBrlCents: number;
  days: number;
  minDailyBudgetCents: number | null;
}): boolean {
  if (!params.minDailyBudgetCents) return false;
  return Math.floor(params.budgetBrlCents / Math.max(1, params.days)) < params.minDailyBudgetCents;
}

/** Fim do dia no fuso da conta, com o deslocamento explícito (`2026-11-15T23:59:00-03:00`). */
export function buildEndTimeIso(endDate: string, timeZone: string | null): string {
  let offset = "-03:00";
  try {
    const timeZoneName = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone ?? "America/Sao_Paulo",
      timeZoneName: "longOffset",
    })
      .formatToParts(new Date(`${endDate}T12:00:00Z`))
      .find((part) => part.type === "timeZoneName")?.value;
    const parsedOffset = timeZoneName?.replace("GMT", "");
    if (parsedOffset === "") offset = "+00:00";
    else if (parsedOffset && /^[+-]\d{2}:\d{2}$/.test(parsedOffset)) offset = parsedOffset;
  } catch {
    // Fuso desconhecido: fica o de Brasília.
  }
  return `${endDate}T23:59:00${offset}`;
}

export interface AdSetSuggestionCandidate {
  adsetId: string;
  spendCents: number;
  conversations: number;
}

/** Sugestão de público: o conjunto com menor custo por conversa, com pelo menos R$ 30 gastos (RF-4). */
export function pickSuggestionAdSet<T extends AdSetSuggestionCandidate>(candidates: T[]): T | null {
  const eligible = candidates.filter((candidate) => candidate.spendCents >= 3_000 && candidate.conversations > 0);
  if (eligible.length === 0) return null;
  return eligible.reduce((best, candidate) =>
    candidate.spendCents / candidate.conversations < best.spendCents / best.conversations ? candidate : best,
  );
}

export function buildDefaultAudience(city: { key: string; name: string } | null): AudienceDraft | null {
  if (!city) return null;
  return { cityKey: city.key, cityName: city.name, radiusKm: MIN_RADIUS_KM, ageMin: MIN_AGE, ageMax: MAX_AGE, gender: "all" };
}
