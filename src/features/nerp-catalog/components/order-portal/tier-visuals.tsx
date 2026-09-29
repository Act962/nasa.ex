"use client";

import { ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { TierPlanet } from "@/features/star-friends/components/tier-planet";
import { TIER_LABELS, type LoyaltyTierId } from "@/features/star-friends/utils/tiers";

export { TierPlanet };

// Cores fixas por nível: o card é "espaço", igual em tema claro e escuro.
export const TIER_GRADIENTS: Record<LoyaltyTierId, string> = {
  EARTH: "bg-gradient-to-br from-[#1e6fd9] to-[#2bb673]",
  MOON: "bg-gradient-to-br from-[#7c8496] to-[#c9ced9]",
  GALAXY: "bg-gradient-to-br from-[#3b0764] to-[#a21caf]",
};

export type TierCardProgress = {
  tier: LoyaltyTierId;
  nextTier: LoyaltyTierId | null;
  starsToNext: number;
  nextMinStars: number;
  percent: number;
};

export function TierCard({
  lifetimeStars,
  progress,
  onOpenJourney,
}: {
  lifetimeStars: number;
  progress: TierCardProgress;
  onOpenJourney?: () => void;
}) {
  const isTop = !progress.nextTier;
  return (
    <button
      type="button"
      onClick={onOpenJourney}
      className={cn(
        "relative w-full overflow-hidden rounded-2xl p-4 text-left text-white shadow-sm transition-transform active:scale-[.99]",
        TIER_GRADIENTS[progress.tier],
      )}
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(1px_1px_at_20%_30%,#fff8,transparent),radial-gradient(1px_1px_at_70%_20%,#fff8,transparent),radial-gradient(1.5px_1.5px_at_85%_70%,#fff9,transparent)]" />
      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center">
        <div>
          <p className="flex items-center gap-1 text-[11px] opacity-85">
            Minhas <Star className="size-3 fill-current" />
          </p>
          <p className="text-3xl leading-none font-extrabold">{lifetimeStars}</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <TierPlanet tier={progress.tier} size={44} />
          <span className="text-sm font-bold">{TIER_LABELS[progress.tier]}</span>
        </div>
        <div className="text-right">
          <p className="text-[11px] opacity-85">{isTop ? "Nível máximo" : `Próximo: ${TIER_LABELS[progress.nextTier!]}`}</p>
          <p className="text-3xl leading-none font-extrabold">{progress.nextMinStars}</p>
        </div>
      </div>
      <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/30">
        <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${progress.percent}%` }} />
      </div>
      <div className="relative mt-1 flex justify-between text-[11px] opacity-90">
        <span>
          {lifetimeStars} de {progress.nextMinStars} ⭐
        </span>
        <span className="flex items-center gap-0.5">
          {isTop ? "Cliente premium" : `faltam ${progress.starsToNext} ${progress.starsToNext === 1 ? "compra" : "compras"}`}
          {onOpenJourney && <ChevronRight className="size-3" />}
        </span>
      </div>
    </button>
  );
}
