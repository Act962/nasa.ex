"use client";

import { Gift, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useCatalogOrderStarFriends,
  useRequestCatalogOrderRedemption,
} from "../../hooks/use-catalog-order-portal";

export function OrderStarFriendsCard({ token }: { token: string }) {
  const starFriends = useCatalogOrderStarFriends(token);
  const requestRedemption = useRequestCatalogOrderRedemption(token);
  const data = starFriends.data;
  if (!data?.isActive) return null;

  const pendingRewardNames = new Set(
    data.pendingRedemptions.map((redemption) => (redemption.rewardSnapshot as { name?: string } | null)?.name),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" /> {data.programName}
          </span>
          <span className="text-2xl font-bold text-amber-500">{data.balance} stars</span>
        </CardTitle>
        <CardDescription>
          Cada compra paga vale {data.starsPerPurchase} {data.starsPerPurchase === 1 ? "star" : "stars"}. Troque
          pelos prêmios abaixo — a loja confirma o seu pedido de troca.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {data.rewards.map((reward) => {
          const isRequested = pendingRewardNames.has(reward.name);
          const isAffordable = data.balance >= reward.costStars && (reward.stock === null || reward.stock > 0);
          return (
            <div key={reward.id} className="flex items-center gap-3 rounded-lg border p-2 text-sm">
              <Gift className="size-4 shrink-0 text-primary" />
              <span className="flex-1">
                {reward.name}
                <span className="block text-xs text-muted-foreground">{reward.costStars} stars</span>
              </span>
              {isRequested ? (
                <Badge variant="secondary">Pedido enviado</Badge>
              ) : (
                <Button
                  size="sm"
                  variant={isAffordable ? "default" : "outline"}
                  disabled={!isAffordable || requestRedemption.isPending}
                  onClick={() =>
                    requestRedemption.mutate(
                      { token, rewardId: reward.id },
                      {
                        onSuccess: () => toast.success("Pedido de troca enviado para a loja"),
                        onError: (error) => toast.error(error.message),
                      },
                    )
                  }
                >
                  Trocar
                </Button>
              )}
            </div>
          );
        })}
        {data.rewards.length === 0 && (
          <p className="text-sm text-muted-foreground">A loja ainda não cadastrou prêmios.</p>
        )}
      </CardContent>
    </Card>
  );
}
