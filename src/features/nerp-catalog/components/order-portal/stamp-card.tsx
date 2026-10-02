"use client";

import { Gift, Lock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TIER_LABELS, type LoyaltyTierId } from "@/features/star-friends/utils/tiers";
import { useRequestCatalogOrderRedemption } from "../../hooks/use-catalog-order-portal";

export type PortalReward = {
  id: string;
  name: string;
  description: string | null;
  costStars: number;
  stock: number | null;
  minTier: LoyaltyTierId;
  isTierLocked: boolean;
};

// Casas visíveis do cartão: acima disso a barra substitui os carimbos, para não quebrar no celular.
const MAX_STAMPS = 10;

// Estrela de 5 pontas com cantos arredondados (stroke-linejoin round), no lugar do círculo tracejado.
const STAR_PATH =
  "M16 3.5l3.6 7.3 8.1 1.2-5.85 5.7 1.4 8.05L16 21.95l-7.25 3.8 1.4-8.05L4.3 12l8.1-1.2z";

function StampStar({ position, isFilled }: { position: number; isFilled: boolean }) {
  return (
    <span className="relative flex size-9 items-center justify-center" aria-label={isFilled ? `Compra ${position} carimbada` : `Compra ${position}`}>
      <svg viewBox="0 0 32 32" className="absolute inset-0 size-full" aria-hidden>
        <path
          d={STAR_PATH}
          strokeWidth="2.2"
          strokeLinejoin="round"
          className={cn(
            isFilled
              ? "fill-warning stroke-warning"
              : "fill-primary/5 stroke-primary/50",
          )}
        />
      </svg>
      {!isFilled && <span className="relative mt-0.5 text-[10px] font-semibold text-primary/80">{position}</span>}
    </span>
  );
}

/** "Comprou X, ganhou Y": cada compra marca uma ⭐ no cartão (spec 0041, RF-4). */
export function StampCard({
  token,
  reward,
  balance,
  isRequested,
  canRedeem,
}: {
  token: string;
  reward: PortalReward;
  balance: number;
  isRequested: boolean;
  canRedeem: boolean;
}) {
  const requestRedemption = useRequestCatalogOrderRedemption(token);
  const filled = Math.min(balance, reward.costStars);
  const missing = Math.max(0, reward.costStars - balance);
  const isOutOfStock = reward.stock !== null && reward.stock <= 0;
  const isComplete = missing === 0;

  const handleRedeem = () =>
    requestRedemption.mutate(
      { token, rewardId: reward.id },
      {
        onSuccess: () => toast.success("Pedido de troca enviado para a loja"),
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl border bg-card p-3", reward.isTierLocked && "opacity-70")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Gift className="size-4 shrink-0 text-primary" />
            <span className="truncate">{reward.name}</span>
          </p>
          {reward.description && <p className="mt-0.5 text-xs text-muted-foreground">{reward.description}</p>}
        </div>
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">
          {Math.min(balance, reward.costStars)} de {reward.costStars}
        </span>
      </div>

      {reward.costStars <= MAX_STAMPS ? (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: reward.costStars }, (_, index) => (
            <StampStar key={index} position={index + 1} isFilled={index < filled} />
          ))}
        </div>
      ) : (
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-warning" style={{ width: `${(filled / reward.costStars) * 100}%` }} />
        </div>
      )}

      {reward.isTierLocked ? (
        <Badge variant="secondary" className="justify-center gap-1 py-1.5">
          <Lock className="size-3" /> Libera no nível {TIER_LABELS[reward.minTier]}
        </Badge>
      ) : isRequested ? (
        <Badge variant="secondary" className="justify-center py-1.5">
          Pedido de troca enviado
        </Badge>
      ) : isOutOfStock ? (
        <Badge variant="outline" className="justify-center py-1.5">
          Esgotado
        </Badge>
      ) : (
        <Button
          size="sm"
          variant={isComplete ? "default" : "outline"}
          className={cn(isComplete && "bg-primary text-primary-foreground hover:bg-primary/90")}
          disabled={!isComplete || !canRedeem || requestRedemption.isPending}
          onClick={handleRedeem}
        >
          {isComplete ? "Trocar agora" : `Faltam ${missing} ${missing === 1 ? "compra" : "compras"}`}
        </Button>
      )}
    </div>
  );
}
