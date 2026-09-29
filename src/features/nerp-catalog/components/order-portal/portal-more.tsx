"use client";

import { ChevronRight } from "lucide-react";
import { TIER_LABELS } from "@/features/star-friends/utils/tiers";
import { TierPlanet } from "./tier-visuals";
import type { PortalMoreScreen, PortalStarFriends } from "./portal-types";

type MenuItem = { screen: PortalMoreScreen; label: string; emoji: string; hint?: string; needsProgram?: boolean };

export function PortalMore({
  starFriends,
  onOpen,
}: {
  starFriends: PortalStarFriends | null;
  onOpen: (screen: PortalMoreScreen) => void;
}) {
  const groups: MenuItem[][] = [
    [
      { screen: "how", label: "Como funciona", emoji: "✨", needsProgram: true },
      { screen: "journey", label: "Minha jornada", emoji: "🚀", needsProgram: true },
      { screen: "history", label: "Histórico de estrelas", emoji: "⭐", needsProgram: true },
      {
        screen: "redemptions",
        label: "Minhas trocas",
        emoji: "🎁",
        hint: starFriends?.redemptions.length ? String(starFriends.redemptions.length) : undefined,
        needsProgram: true,
      },
      { screen: "orders", label: "Meus pedidos", emoji: "🧾" },
    ],
    [
      { screen: "data", label: "Meus dados", emoji: "👤" },
      { screen: "rules", label: "Regulamento do programa", emoji: "📜", needsProgram: true },
      { screen: "help", label: "Ajuda e contato da loja", emoji: "💬" },
    ],
  ];

  return (
    <div className="flex flex-col gap-4">
      {starFriends && (
        <button
          type="button"
          onClick={() => onOpen("journey")}
          className="flex items-center gap-3 rounded-2xl border bg-card p-3 text-left"
        >
          <TierPlanet tier={starFriends.tier.tier} size={40} />
          <div className="flex-1">
            <p className="text-sm font-semibold">Cliente {TIER_LABELS[starFriends.tier.tier]}</p>
            <p className="text-xs text-muted-foreground">
              {starFriends.lifetimeStars} ⭐ na vida · {starFriends.balance} para trocar
            </p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
      )}
      {groups.map((group, groupIndex) => (
        <div key={groupIndex} className="overflow-hidden rounded-2xl border bg-card">
          {group
            .filter((item) => !item.needsProgram || starFriends)
            .map((item) => (
              <button
                key={item.screen}
                type="button"
                onClick={() => onOpen(item.screen)}
                className="flex w-full items-center justify-between border-b px-4 py-3.5 text-left text-sm last:border-0"
              >
                <span>
                  <span className="mr-2">{item.emoji}</span>
                  {item.label}
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                  {item.hint}
                  <ChevronRight className="size-4" />
                </span>
              </button>
            ))}
        </div>
      ))}
    </div>
  );
}
