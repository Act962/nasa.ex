"use client";

import { useState } from "react";
import { Check, PackageCheck, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { OrbitaSpinner } from "@/components/orbita-spinner";
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

  const actionButtonClass = "h-11 w-full rounded-full sm:h-9 sm:w-auto";

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)}>
      {(canActOnPending || canCancel) && (
        <Input
          className="h-11 w-full rounded-full sm:h-9 sm:max-w-sm"
          placeholder="Motivo (obrigatório para recusar/cancelar)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      )}
      {canActOnPending && (
        <>
          <Button className={actionButtonClass} disabled={decide.isPending} onClick={() => handleDecision("APPROVE")}>
            {decide.isPending ? <OrbitaSpinner className="size-4" /> : <Check className="size-4" />}
            Aprovar
          </Button>
          <Button
            variant="outline"
            className={actionButtonClass}
            disabled={decide.isPending}
            onClick={() => handleDecision("REJECT")}
          >
            <X className="size-4" /> Recusar
          </Button>
        </>
      )}
      {canDeliver && (
        <Button className={actionButtonClass} disabled={decide.isPending} onClick={() => handleDecision("DELIVER")}>
          {decide.isPending ? <OrbitaSpinner className="size-4" /> : <PackageCheck className="size-4" />}
          Marcar como entregue
        </Button>
      )}
      {canCancel && (
        <Button
          variant="outline"
          className={actionButtonClass}
          disabled={decide.isPending}
          onClick={() => handleDecision("CANCEL")}
        >
          <Undo2 className="size-4" /> Cancelar e estornar
        </Button>
      )}
    </div>
  );
}
