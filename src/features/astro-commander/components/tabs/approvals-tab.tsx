"use client";

import { toast } from "sonner";
import { Check, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useApproveAstroAction,
  useAstroApprovals,
  useRejectAstroAction,
} from "@/features/astro-commander/hooks/use-astro-runs";
import { formatDateTime } from "@/features/astro-commander/lib/labels";

/**
 * Fila de aprovação da organização (spec 0028, RF-11). Até aqui, o que o
 * comando preparou não saiu do lugar.
 */
export function ApprovalsTab() {
  const { approvals, isLoading } = useAstroApprovals();
  const approve = useApproveAstroAction();
  const reject = useRejectAstroAction();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1].map((row) => (
          <Skeleton key={row} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (approvals.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
        <ShieldCheck className="size-8 text-muted-foreground" />
        <p className="font-medium">Nada esperando aprovação</p>
        <p className="text-sm text-muted-foreground">
          Quando um comando preparar uma ação que precisa de gente, ela aparece
          aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {approvals.map((approval) => (
        <div
          key={approval.id}
          className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">
                {approval.commandTitle ?? "Ação do ASTRO"}
              </span>
              <Badge variant="outline">{approval.actionType}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{approval.summary}</p>
            <p className="text-xs text-muted-foreground">
              Criada em {formatDateTime(approval.createdAt)} · expira em{" "}
              {formatDateTime(approval.expiresAt)}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                reject.mutate(
                  { id: approval.id },
                  {
                    onSuccess: (result) => toast.success(result.summary),
                    onError: (error) => toast.error(error.message),
                  },
                )
              }
              disabled={reject.isPending || approve.isPending}
            >
              <X className="size-4" />
              Rejeitar
            </Button>
            <Button
              onClick={() =>
                approve.mutate(
                  { id: approval.id },
                  {
                    onSuccess: (result) =>
                      result.ok
                        ? toast.success(result.summary)
                        : toast.error(result.summary),
                    onError: (error) => toast.error(error.message),
                  },
                )
              }
              disabled={approve.isPending || reject.isPending}
            >
              <Check className="size-4" />
              Aprovar
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
