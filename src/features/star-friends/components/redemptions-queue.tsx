"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDecideStarFriendsRedemption, useStarFriendsRedemptions } from "../hooks/use-star-friends";
import { useStarFriendsPermissions } from "../hooks/use-star-friends-permissions";
import { REDEMPTION_CHANNEL_LABELS, REDEMPTION_STATUS_LABELS, describeSnapshot } from "../utils/labels";

type RedemptionStatus = "PENDING" | "APPROVED" | "DELIVERED" | "REJECTED" | "CANCELED";
type Decision = "APPROVE" | "REJECT" | "DELIVER" | "CANCEL";

export function RedemptionsQueue() {
  const [status, setStatus] = useState<RedemptionStatus>("PENDING");
  const redemptions = useStarFriendsRedemptions(status);
  const decide = useDecideStarFriendsRedemption();
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const permissions = useStarFriendsPermissions();

  const handleDecision = (redemptionId: string, decision: Decision) => {
    decide.mutate(
      { redemptionId, decision, reason: reasonById[redemptionId] || undefined },
      {
        onSuccess: () => toast.success("Resgate atualizado"),
        onError: (error) => toast.error(error.message),
      },
    );
  };

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
        const canActOnPending = redemption.status === "PENDING" && permissions.canApproveRedemptions;
        const canActOnApproved =
          redemption.status === "APPROVED" && (permissions.canApproveRedemptions || permissions.canDebitAndCancel);
        const needsReason = canActOnPending || canActOnApproved;
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
            {needsReason && (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="max-w-sm"
                  placeholder="Motivo (obrigatório para recusar/cancelar)"
                  value={reasonById[redemption.id] ?? ""}
                  onChange={(event) => setReasonById({ ...reasonById, [redemption.id]: event.target.value })}
                />
                {canActOnPending && (
                  <>
                    <Button size="sm" disabled={decide.isPending} onClick={() => handleDecision(redemption.id, "APPROVE")}>
                      Aprovar
                    </Button>
                    <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => handleDecision(redemption.id, "REJECT")}>
                      Recusar
                    </Button>
                  </>
                )}
                {redemption.status === "APPROVED" && permissions.canApproveRedemptions && (
                  <Button size="sm" disabled={decide.isPending} onClick={() => handleDecision(redemption.id, "DELIVER")}>
                    Marcar como entregue
                  </Button>
                )}
                {redemption.status === "APPROVED" && permissions.canDebitAndCancel && (
                  <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => handleDecision(redemption.id, "CANCEL")}>
                    Cancelar e estornar
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
