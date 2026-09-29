"use client";

import type { LoyaltyTierId } from "../utils/tiers";

/** Planeta de cada nível do STAR FRIENDS (spec 0041): Terra, Lua e Galaxy. */
export function TierPlanet({ tier, size = 40, className }: { tier: LoyaltyTierId; size?: number; className?: string }) {
  if (tier === "MOON") {
    return (
      <svg width={size} height={size} viewBox="0 0 44 44" className={className} aria-hidden>
        <circle cx="22" cy="22" r="18" fill="#e6e9ef" />
        <circle cx="15" cy="17" r="4" fill="#9aa3b5" />
        <circle cx="27" cy="27" r="5" fill="#9aa3b5" />
        <circle cx="28" cy="13" r="2.5" fill="#9aa3b5" />
      </svg>
    );
  }
  if (tier === "GALAXY") {
    return (
      <svg width={size} height={size} viewBox="0 0 44 44" className={className} aria-hidden>
        <defs>
          <radialGradient id="tier-galaxy-core">
            <stop offset="0" stopColor="#f0abfc" />
            <stop offset=".5" stopColor="#a21caf" />
            <stop offset="1" stopColor="#3b0764" />
          </radialGradient>
        </defs>
        <circle cx="22" cy="22" r="17" fill="url(#tier-galaxy-core)" />
        <ellipse cx="22" cy="22" rx="21" ry="6" fill="none" stroke="#f5d0fe" strokeWidth="1.5" transform="rotate(-18 22 22)" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" className={className} aria-hidden>
      <circle cx="22" cy="22" r="18" fill="#2f86ef" />
      <path d="M8 20c5-4 8 2 13-1s5-8 11-5c2 3 3 6 2 9-4-1-6 3-10 2s-6 5-11 3c-3-2-5-5-5-8z" fill="#4ade80" />
      <circle cx="22" cy="22" r="18" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="1.5" />
    </svg>
  );
}
