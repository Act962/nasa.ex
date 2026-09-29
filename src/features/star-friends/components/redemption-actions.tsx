"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDecideStarFriendsRedemption } from "../hooks/use-star-friends";
import { useStarFriendsPermissions } from "../hooks/use-star-friends-permissions";

type RedemptionStatus = "PENDING" | "APPROVED" | "DELIVERED" | "REJECTED" | "CANCELED";
type Decision = "APPROVE" | "REJECT" | "DELIVER" | "CANCEL";

/** Aprovar, recusar, entregar ou cancelar um resgate — usado na fila e nos Detalhes do lead. */
export function RedemptionActions({
  redemption,
  className,
}: {
  redemption: { id: string; status: RedemptionStatus };
  className?: string;
}) {
  const decide = useDecideStarFriendsRedemption();
  const permissions = useStarFriendsPermissions();
  const [reason, setReason] = useState("");

  const canActOnPending = redemption.status === "PENDING" && permissions.canApproveRedemptions;
  const canDeliver = redemption.status === "APPROVED" && permissions.canApproveRedemptions;
  const canCancel = redemption.status === "APPROVED" && permissions.canDebitAndCancel;
  if (!canActOnPending && !canDeliver && !canCancel) return null;

  const handleDecision = (decision: Decision) => {
    decide.mutate(
      { redemptionId: redemption.id, decision, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          setReason("");
          toast.success("Resgate atualizado");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {(canActOnPending || canCancel) && (
        <Input
          className="max-w-sm"
          placeholder="Motivo (obrigatório para recusar/cancelar)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      )}
      {canActOnPending && (
        <>
          <Button size="sm" disabled={decide.isPending} onClick={() => handleDecision("APPROVE")}>
            Aprovar
          </Button>
          <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => handleDecision("REJECT")}>
            Recusar
          </Button>
        </>
      )}
      {canDeliver && (
        <Button size="sm" disabled={decide.isPending} onClick={() => handleDecision("DELIVER")}>
          Marcar como entregue
        </Button>
      )}
      {canCancel && (
        <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => handleDecision("CANCEL")}>
          Cancelar e estornar
        </Button>
      )}
    </div>
  );
}
