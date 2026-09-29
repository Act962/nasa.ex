"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStarFriendsRedemptions } from "../hooks/use-star-friends";
import { RedemptionActions } from "./redemption-actions";
import { REDEMPTION_CHANNEL_LABELS, REDEMPTION_STATUS_LABELS, describeSnapshot } from "../utils/labels";

type RedemptionStatus = "PENDING" | "APPROVED" | "DELIVERED" | "REJECTED" | "CANCELED";

export function RedemptionsQueue() {
  const [status, setStatus] = useState<RedemptionStatus>("PENDING");
  const redemptions = useStarFriendsRedemptions(status);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Pedidos feitos pelo Astro ou pelo portal chegam aqui para aprovação. As stars só saem do saldo quando
        o resgate é aprovado; cancelar um resgate aprovado devolve as stars (estorno).
      </p>
      <Tabs value={status} onValueChange={(value) => setStatus(value as RedemptionStatus)}>
        <TabsList>
          {(Object.keys(REDEMPTION_STATUS_LABELS) as RedemptionStatus[]).map((statusKey) => (
            <TabsTrigger key={statusKey} value={statusKey}>
              {REDEMPTION_STATUS_LABELS[statusKey]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {redemptions.data?.redemptions.length === 0 && (
        <p className="text-sm text-muted-foreground">Nada por aqui.</p>
      )}
      {redemptions.data?.redemptions.map((redemption) => {
        return (
          <div key={redemption.id} className="flex flex-col gap-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{describeSnapshot(redemption.rewardSnapshot)}</p>
                <p className="text-sm text-muted-foreground">
                  {redemption.member.name} · {redemption.member.phone} · {redemption.costStars} stars
                </p>
              </div>
              <Badge variant="outline">{REDEMPTION_CHANNEL_LABELS[redemption.requestedVia]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Pedido por {redemption.requestedByName} em {format(new Date(redemption.createdAt), "dd/MM/yyyy HH:mm")}
              {redemption.decidedByName &&
                ` · decidido por ${redemption.decidedByName}${redemption.decidedAt ? ` em ${format(new Date(redemption.decidedAt), "dd/MM/yyyy HH:mm")}` : ""}`}
              {redemption.deliveredByName &&
                ` · entregue por ${redemption.deliveredByName}${redemption.deliveredAt ? ` em ${format(new Date(redemption.deliveredAt), "dd/MM/yyyy HH:mm")}` : ""}`}
              {redemption.decisionReason && ` · motivo: ${redemption.decisionReason}`}
            </p>
            <RedemptionActions redemption={redemption} />
          </div>
        );
      })}
    </div>
  );
}
