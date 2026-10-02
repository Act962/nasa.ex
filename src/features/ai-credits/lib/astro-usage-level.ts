import type { AiCreditProviderSummary } from "./ai-credit-types";

/** Percentual e cor do ícone de uso do ASTRO: vale o limite mais perto de acabar (spec 0055, RF-10). */

export type AstroUsageTone = "calm" | "attention" | "high" | "limit";

export const ASTRO_USAGE_TONE_COLORS: Record<AstroUsageTone, string> = {
  calm: "var(--info)",
  attention: "var(--warning)",
  high: "var(--temp-hot)",
  limit: "var(--destructive)",
};

const ATTENTION_PERCENT = 50;
const HIGH_PERCENT = 75;
const LIMIT_PERCENT = 90;
const CRITICAL_DAYS_LEFT = 7;
const STARS_CRITICAL_MINIMUM = 50;
const STARS_CRITICAL_PLAN_SHARE = 0.05;

export interface AstroUsageInput {
  aiMode: "PLATFORM" | "OWN" | null;
  activeProvider: string | null;
  stars?: { consumedInCycle: number; planMonthlyStars: number; balance: number; bonusBalance: number } | null;
  ownCredits: Array<{ provider: string; credit: AiCreditProviderSummary | null; isExhausted: boolean }>;
}

export interface AstroUsageLevel {
  usedPercent: number | null;
  tone: AstroUsageTone;
  /** O que o percentual mede, para o título do ícone. */
  basisLabel: string;
}

function toneForPercent(usedPercent: number): AstroUsageTone {
  if (usedPercent >= LIMIT_PERCENT) return "limit";
  if (usedPercent >= HIGH_PERCENT) return "high";
  if (usedPercent >= ATTENTION_PERCENT) return "attention";
  return "calm";
}

export function computeAstroUsageLevel(input: AstroUsageInput): AstroUsageLevel {
  const candidates: Array<{ usedPercent: number; isCritical: boolean; basisLabel: string }> = [];

  const activeOwnCredit = input.ownCredits.find((ownCredit) => ownCredit.provider === input.activeProvider);
  if (activeOwnCredit?.isExhausted) {
    candidates.push({ usedPercent: 100, isCritical: true, basisLabel: "crédito da sua IA esgotado" });
  } else if (activeOwnCredit?.credit && activeOwnCredit.credit.remainingPercent !== null) {
    const daysLeft = activeOwnCredit.credit.daysLeft;
    candidates.push({
      usedPercent: 100 - activeOwnCredit.credit.remainingPercent,
      isCritical: daysLeft !== null && daysLeft <= CRITICAL_DAYS_LEFT,
      basisLabel: "saldo da sua IA usado",
    });
  }

  // Stars pagam o modelo ÓRBITA e a taxa de cada pedido, então contam nos dois modos.
  if (input.stars && input.stars.planMonthlyStars > 0) {
    const totalAvailable = input.stars.balance + input.stars.bonusBalance;
    const criticalThreshold = Math.max(STARS_CRITICAL_MINIMUM, input.stars.planMonthlyStars * STARS_CRITICAL_PLAN_SHARE);
    candidates.push({
      usedPercent: Math.min(100, (input.stars.consumedInCycle / input.stars.planMonthlyStars) * 100),
      isCritical: totalAvailable < criticalThreshold,
      basisLabel: "Stars do ciclo usadas",
    });
  }

  if (candidates.length === 0) return { usedPercent: null, tone: "calm", basisLabel: "sem limite medido" };

  const worstCandidate = candidates.reduce((worst, candidate) => {
    const worstScore = worst.isCritical ? 1000 + worst.usedPercent : worst.usedPercent;
    const candidateScore = candidate.isCritical ? 1000 + candidate.usedPercent : candidate.usedPercent;
    return candidateScore > worstScore ? candidate : worst;
  });
  return {
    usedPercent: Math.round(worstCandidate.usedPercent),
    tone: worstCandidate.isCritical ? "limit" : toneForPercent(worstCandidate.usedPercent),
    basisLabel: worstCandidate.basisLabel,
  };
}
