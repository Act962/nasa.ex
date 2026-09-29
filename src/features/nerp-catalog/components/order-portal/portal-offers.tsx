"use client";

import { useState } from "react";
import { ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StampCard } from "./stamp-card";
import type { PortalStarFriends } from "./portal-types";

type OffersFilter = "available" | "locked";

export function PortalOffers({
  token,
  starFriends,
  catalogUrl,
}: {
  token: string;
  starFriends: PortalStarFriends | null;
  catalogUrl: string | null;
}) {
  const [filter, setFilter] = useState<OffersFilter>("available");
  if (!starFriends) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-muted-foreground">
        <ShoppingBasket className="size-8 text-primary" />
        A loja ainda não tem programa de prêmios.
        {catalogUrl && (
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
            <a href={catalogUrl} target="_blank" rel="noopener noreferrer">
              Ver o catálogo
            </a>
          </Button>
        )}
      </div>
    );
  }

  const requestedRewardNames = new Set(
    starFriends.pendingRedemptions.map((redemption) => (redemption.rewardSnapshot as { name?: string } | null)?.name),
  );
  const visibleRewards = starFriends.rewards.filter((reward) =>
    filter === "available" ? !reward.isTierLocked : reward.isTierLocked,
  );
  const hasLockedRewards = starFriends.rewards.some((reward) => reward.isTierLocked);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {(
          [
            ["available", "Prêmios"],
            ["locked", "Próximos níveis"],
          ] as const
        ).map(([filterId, label]) => (
          <button
            key={filterId}
            type="button"
            onClick={() => setFilter(filterId)}
            disabled={filterId === "locked" && !hasLockedRewards}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-40",
              filter === filterId ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {visibleRewards.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhum prêmio por aqui ainda.</p>
      )}
      {visibleRewards.map((reward) => (
        <StampCard
          key={reward.id}
          token={token}
          reward={reward}
          balance={starFriends.balance}
          isRequested={requestedRewardNames.has(reward.name)}
          canRedeem={starFriends.hasMember}
        />
      ))}

      {catalogUrl && (
        <a
          href={catalogUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-2xl border bg-card p-4 text-sm font-semibold"
        >
          <span className="flex items-center gap-2">
            <ShoppingBasket className="size-4 text-primary" /> Promoções e produtos da loja
          </span>
          <span className="text-primary">Abrir catálogo ›</span>
        </a>
      )}
    </div>
  );
}
