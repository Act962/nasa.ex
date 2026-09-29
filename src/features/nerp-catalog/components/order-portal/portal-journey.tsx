"use client";

import { useMemo } from "react";
import { SpaceJourney, type JourneyStop } from "@/features/space-journey";
import { TIER_LABELS } from "@/features/star-friends/utils/tiers";
import type { PortalStarFriends } from "./portal-types";

// Mais paradas que isso deixa os asteroides colados no celular (regra do docs/space-journey-gamificacao.md).
const MAX_ASTEROIDS = 36;

type StopWithStars = JourneyStop & { minStars: number };

/** Terra → Lua → Galaxy: um asteroide por ⭐ (agrupados quando os limites são altos). */
function buildTierStops(moonMinStars: number, galaxyMinStars: number): StopWithStars[] {
  const step = Math.max(1, Math.ceil((galaxyMinStars - 2) / MAX_ASTEROIDS));
  const asteroidsBetween = (fromStars: number, toStars: number): StopWithStars[] => {
    const stops: StopWithStars[] = [];
    for (let stars = fromStars + step; stars < toStars; stars += step) {
      stops.push({ id: `star-${stars}`, kind: "asteroid", label: `${stars} ⭐`, minStars: stars });
    }
    return stops;
  };
  return [
    { id: "earth", kind: "planet", label: `${TIER_LABELS.EARTH} · 0 ⭐`, palette: "teal", surface: "bands", minStars: 0 },
    ...asteroidsBetween(0, moonMinStars),
    { id: "moon", kind: "planet", label: `${TIER_LABELS.MOON} · ${moonMinStars} ⭐`, palette: "sky", surface: "craters", minStars: moonMinStars },
    ...asteroidsBetween(moonMinStars, galaxyMinStars),
    {
      id: "galaxy",
      kind: "planet",
      label: `${TIER_LABELS.GALAXY} · ${galaxyMinStars} ⭐`,
      palette: "violet",
      surface: "bands",
      hasRing: true,
      isDestination: true,
      minStars: galaxyMinStars,
    },
  ];
}

export function PortalJourney({ starFriends }: { starFriends: PortalStarFriends }) {
  const { moonMinStars, galaxyMinStars } = starFriends.tiers;
  const stops = useMemo(() => buildTierStops(moonMinStars, galaxyMinStars), [moonMinStars, galaxyMinStars]);
  const currentIndex = stops.reduce(
    (lastReached, stop, index) => (starFriends.lifetimeStars >= stop.minStars ? index : lastReached),
    0,
  );
  const { tier } = starFriends;
  const nextPerks = tier.nextTier === "MOON" ? starFriends.tiers.moonPerks : starFriends.tiers.galaxyPerks;

  return (
    <div className="flex flex-col gap-3">
      <SpaceJourney
        stops={stops}
        currentIndex={currentIndex}
        title="Sua viagem"
        starCount={starFriends.lifetimeStars}
        fuelLabel={tier.nextTier ? `Rumo à ${TIER_LABELS[tier.nextTier]}` : "Você chegou à Galaxy"}
        className="min-h-[460px]"
      />
      <div className="rounded-2xl border bg-card p-4 text-sm">
        {tier.nextTier ? (
          <>
            <p className="font-semibold">
              Mais {tier.starsToNext} {tier.starsToNext === 1 ? "compra" : "compras"} e você vira cliente {TIER_LABELS[tier.nextTier]}.
            </p>
            {nextPerks && <p className="mt-1 text-muted-foreground">{nextPerks}</p>}
          </>
        ) : (
          <p className="font-semibold">Você é cliente Galaxy, o nível mais alto da loja. 👑</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          O nível conta as ⭐ ganhas na vida toda: trocar prêmios não faz você descer.
        </p>
      </div>
    </div>
  );
}
