"use client";

import { ChevronRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBrl } from "../../utils/format-order";
import { OrderStatusTimeline } from "./order-status-timeline";
import { OrderPaymentCard } from "./order-payment-card";
import { OrderPixStartCard } from "./order-pix-start-card";
import { StampCard } from "./stamp-card";
import { TierCard } from "./tier-visuals";
import type { PortalOrder, PortalStarFriends } from "./portal-types";

// Na Home cabem os cartões mais próximos de completar; o resto fica em Ofertas.
const HOME_STAMP_CARDS = 2;

export function PortalHome({
  token,
  order,
  starFriends,
  onOpenJourney,
  onOpenOffers,
  onOpenChat,
}: {
  token: string;
  order: PortalOrder;
  starFriends: PortalStarFriends | null;
  onOpenJourney: () => void;
  onOpenOffers: () => void;
  onOpenChat: () => void;
}) {
  const isAwaitingPayment = order.status === "AWAITING_PAYMENT";
  const requestedRewardNames = new Set(
    (starFriends?.pendingRedemptions ?? []).map(
      (redemption) => (redemption.rewardSnapshot as { name?: string } | null)?.name,
    ),
  );
  const nearestRewards = (starFriends?.rewards ?? [])
    .filter((reward) => !reward.isTierLocked)
    .sort((first, second) => first.costStars - second.costStars)
    .slice(0, HOME_STAMP_CARDS);

  return (
    <div className="flex flex-col gap-4">
      {starFriends && (
        <>
          <TierCard lifetimeStars={starFriends.lifetimeStars} progress={starFriends.tier} onOpenJourney={onOpenJourney} />
          <button
            type="button"
            onClick={onOpenOffers}
            className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-chart-4 to-chart-2 p-3.5 text-left text-white"
          >
            <span className="text-xs leading-snug font-bold tracking-wide uppercase">
              Cada compra paga vale {starFriends.starsPerPurchase} ⭐
              <br />
              junte e troque por prêmios
            </span>
            <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold whitespace-nowrap text-primary">
              Ver prêmios
            </span>
          </button>
        </>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Seu pedido</h2>
        <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">Pedido #{order.saleNumber}</p>
              <p className="text-xs text-muted-foreground">
                {order.items.map((item) => `${item.quantity}x ${item.name}`).join(" · ")}
              </p>
            </div>
            <span className="font-semibold whitespace-nowrap">{formatBrl(order.total)}</span>
          </div>
          <OrderStatusTimeline status={order.status} logisticsStage={order.logisticsStage} stageKey={order.stageKey} />
          {isAwaitingPayment && <OrderPaymentCard payment={order.payment} />}
          {order.payment.canPayWithPix && <OrderPixStartCard token={token} />}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onOpenChat}>
              <MessageCircle className="size-4" /> Falar com a loja
            </Button>
            {order.whatsappUrl && (
              <Button variant="outline" className="flex-1" asChild>
                <a href={order.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
              </Button>
            )}
          </div>
        </div>
      </section>

      {starFriends && nearestRewards.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-base font-semibold">Comprou, ganhou</h2>
              <p className="text-xs text-muted-foreground">Cada compra marca ⭐ no cartão.</p>
            </div>
            <button type="button" onClick={onOpenOffers} className="flex items-center text-xs font-semibold text-primary">
              Todos <ChevronRight className="size-3.5" />
            </button>
          </div>
          {nearestRewards.map((reward) => (
            <StampCard
              key={reward.id}
              token={token}
              reward={reward}
              balance={starFriends.balance}
              isRequested={requestedRewardNames.has(reward.name)}
              canRedeem={starFriends.hasMember}
            />
          ))}
        </section>
      )}
    </div>
  );
}
