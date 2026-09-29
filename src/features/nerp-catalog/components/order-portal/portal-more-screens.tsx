"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, MessageCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LEDGER_TYPE_LABELS,
  REDEMPTION_STATUS_LABELS,
  describeSnapshot,
} from "@/features/star-friends/utils/labels";
import { TIER_LABELS, TIER_ORDER, tierMinStars } from "@/features/star-friends/utils/tiers";
import { useCatalogOrderCustomerOrders } from "../../hooks/use-catalog-order-portal";
import { formatBrl } from "../../utils/format-order";
import { TierPlanet } from "./tier-visuals";
import type { PortalOrder, PortalStarFriends } from "./portal-types";

const ORDER_STATUS_LABELS: Record<string, string> = {
  RECEIVED: "Recebido",
  NEGOTIATING: "Em confirmação",
  AWAITING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  IN_LOGISTICS: "Em separação",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
};

export function HowItWorksScreen({ starFriends }: { starFriends: PortalStarFriends }) {
  const perksByTier = {
    EARTH: starFriends.tiers.earthPerks,
    MOON: starFriends.tiers.moonPerks,
    GALAXY: starFriends.tiers.galaxyPerks,
  };
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-2 rounded-2xl border bg-card p-4 text-sm">
        {[
          `Cada compra paga vale ${starFriends.starsPerPurchase} ⭐.`,
          "Complete os cartões e troque pelos prêmios.",
          "Suba de nível e libere prêmios exclusivos.",
        ].map((step, index) => (
          <li key={step} className="flex gap-3">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary dark:bg-primary/20">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <div className="rounded-2xl border bg-card p-4">
        <p className="text-sm font-semibold">Níveis</p>
        <div className="relative mt-4 flex justify-between px-2">
          <span className="absolute top-4 right-6 left-6 h-0.5 bg-primary" />
          {TIER_ORDER.map((tier) => (
            <div key={tier} className="relative flex flex-col items-center gap-1 text-xs font-semibold">
              <TierPlanet tier={tier} size={32} />
              <span className="text-sm">{tierMinStars(tier, starFriends.tiers)} ⭐</span>
              {TIER_LABELS[tier]}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {TIER_ORDER.filter((tier) => perksByTier[tier]).map((tier) => (
          <div key={tier} className="flex items-start gap-3 rounded-2xl border bg-card p-3 text-sm">
            <TierPlanet tier={tier} size={28} />
            <div>
              <p className="font-semibold">Cliente {TIER_LABELS[tier]}</p>
              <p className="text-muted-foreground">{perksByTier[tier]}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StarHistoryScreen({ starFriends }: { starFriends: PortalStarFriends }) {
  if (starFriends.entries.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Sem movimentações ainda.</p>;
  }
  return (
    <div className="flex flex-col rounded-2xl border bg-card px-3">
      {starFriends.entries.map((entry) => {
        const isCredit = entry.stars > 0;
        return (
          <div key={entry.id} className="flex items-center gap-3 border-b py-3 last:border-0">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full",
                isCredit ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15" : "bg-red-50 text-red-600 dark:bg-red-500/15",
              )}
            >
              {isCredit ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-medium">{entry.reason ?? describeSnapshot(entry.itemsSnapshot)}</p>
              <p className="text-xs text-muted-foreground">
                {LEDGER_TYPE_LABELS[entry.type] ?? entry.type} · {format(new Date(entry.createdAt), "dd/MM/yyyy")}
              </p>
            </div>
            <span className={cn("text-sm font-bold", isCredit ? "text-emerald-600" : "text-red-500")}>
              {isCredit ? "+" : ""}
              {entry.stars} ⭐
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function RedemptionsScreen({ starFriends }: { starFriends: PortalStarFriends }) {
  if (starFriends.redemptions.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Você ainda não trocou prêmios.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {starFriends.redemptions.map((redemption) => (
        <div key={redemption.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-3 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium">{describeSnapshot(redemption.rewardSnapshot)}</p>
            <p className="text-xs text-muted-foreground">
              {redemption.costStars} ⭐ · {format(new Date(redemption.createdAt), "dd/MM/yyyy")}
            </p>
          </div>
          <Badge variant="outline">{REDEMPTION_STATUS_LABELS[redemption.status] ?? redemption.status}</Badge>
        </div>
      ))}
    </div>
  );
}

export function CustomerOrdersScreen({ token }: { token: string }) {
  const customerOrders = useCatalogOrderCustomerOrders(token);
  if (customerOrders.isLoading) {
    return <Loader2 className="mx-auto my-10 size-5 animate-spin text-muted-foreground" />;
  }
  return (
    <div className="flex flex-col gap-2">
      {(customerOrders.data?.orders ?? []).map((customerOrder) => (
        <Link
          key={customerOrder.token}
          href={`/pedido/${customerOrder.token}`}
          className={cn(
            "flex items-center justify-between gap-3 rounded-2xl border bg-card p-3 text-sm",
            customerOrder.isCurrent && "border-primary",
          )}
        >
          <div>
            <p className="font-medium">
              Pedido #{customerOrder.saleNumber} {customerOrder.isCurrent && <span className="text-xs text-primary">· este</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(customerOrder.createdAt), "dd/MM/yyyy")} · {ORDER_STATUS_LABELS[customerOrder.status] ?? customerOrder.status}
            </p>
          </div>
          <span className="font-semibold">{formatBrl(customerOrder.total)}</span>
        </Link>
      ))}
    </div>
  );
}

export function CustomerDataScreen({ order }: { order: PortalOrder }) {
  const rows = [
    ["Nome", order.customer.name],
    ["WhatsApp", order.customer.phoneMasked ?? "—"],
    ["Loja", order.store.name],
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border bg-card px-4">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between border-b py-3 text-sm last:border-0">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Para mudar seus dados, fale com a loja pelo chat.</p>
    </div>
  );
}

export function RulesScreen({ starFriends }: { starFriends: PortalStarFriends }) {
  return (
    <div className="rounded-2xl border bg-card p-4 text-sm whitespace-pre-wrap">
      {starFriends.rules?.trim() || "A loja ainda não publicou o regulamento do programa."}
    </div>
  );
}

export function HelpScreen({ order, onOpenChat }: { order: PortalOrder; onOpenChat: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" onClick={onOpenChat}>
        <MessageCircle className="size-4" /> Falar com a loja pelo chat
      </Button>
      {order.whatsappUrl && (
        <Button variant="outline" asChild>
          <a href={order.whatsappUrl} target="_blank" rel="noopener noreferrer">
            Continuar no WhatsApp
          </a>
        </Button>
      )}
    </div>
  );
}
