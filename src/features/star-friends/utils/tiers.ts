// Níveis Terra/Lua/Galaxy (spec 0041) — regras puras, sem banco.

export type LoyaltyTierId = "EARTH" | "MOON" | "GALAXY";

export const TIER_ORDER: LoyaltyTierId[] = ["EARTH", "MOON", "GALAXY"];

export const TIER_LABELS: Record<LoyaltyTierId, string> = {
  EARTH: "Terra",
  MOON: "Lua",
  GALAXY: "Galaxy",
};

export type TierThresholds = { moonMinStars: number; galaxyMinStars: number };

// Trocas, estornos e expiração não contam: o nível mede o quanto o cliente já comprou (RF-2).
const LIFETIME_LEDGER_TYPES = new Set(["EARN", "ADJUST_CREDIT", "ADJUST_DEBIT"]);

export function lifetimeStarsFrom(entries: { type: string; stars: number }[]): number {
  const total = entries
    .filter((entry) => LIFETIME_LEDGER_TYPES.has(entry.type))
    .reduce((sum, entry) => sum + entry.stars, 0);
  return Math.max(0, total);
}

export function tierMinStars(tier: LoyaltyTierId, thresholds: TierThresholds): number {
  if (tier === "GALAXY") return thresholds.galaxyMinStars;
  if (tier === "MOON") return thresholds.moonMinStars;
  return 0;
}

export function resolveTier(lifetimeStars: number, thresholds: TierThresholds): LoyaltyTierId {
  if (lifetimeStars >= thresholds.galaxyMinStars) return "GALAXY";
  if (lifetimeStars >= thresholds.moonMinStars) return "MOON";
  return "EARTH";
}

export function isTierReached(current: LoyaltyTierId, required: LoyaltyTierId): boolean {
  return TIER_ORDER.indexOf(current) >= TIER_ORDER.indexOf(required);
}

export type TierProgress = {
  tier: LoyaltyTierId;
  nextTier: LoyaltyTierId | null;
  /** ⭐ que faltam para o próximo nível; 0 quando já é Galaxy. */
  starsToNext: number;
  /** Limite do próximo nível (ou do atual, no topo). */
  nextMinStars: number;
  /** 0–100, entre o piso do nível atual e o próximo. */
  percent: number;
};

export function tierProgress(lifetimeStars: number, thresholds: TierThresholds): TierProgress {
  const tier = resolveTier(lifetimeStars, thresholds);
  const nextTier = tier === "EARTH" ? "MOON" : tier === "MOON" ? "GALAXY" : null;
  if (!nextTier) {
    return { tier, nextTier, starsToNext: 0, nextMinStars: thresholds.galaxyMinStars, percent: 100 };
  }
  const floor = tierMinStars(tier, thresholds);
  const ceiling = tierMinStars(nextTier, thresholds);
  const span = Math.max(1, ceiling - floor);
  return {
    tier,
    nextTier,
    starsToNext: Math.max(0, ceiling - lifetimeStars),
    nextMinStars: ceiling,
    percent: Math.min(100, Math.round(((lifetimeStars - floor) / span) * 100)),
  };
}
