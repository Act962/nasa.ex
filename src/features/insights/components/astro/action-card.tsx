"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Card de confirmação no chat — aparece quando uma tool propose retornou
 * `requiresConfirmation: true` com `pendingActionId` + `summary`.
 *
 * Click em Confirmar → chama `metaAds.executeMcpAction`.
 * Click em Cancelar → chama `metaAds.cancelMcpAction`.
 *
 * Após executar/cancelar, o card vira read-only mostrando o resultado.
 */
export function AstroActionCard({
  pendingActionId,
  summary,
  toolName,
  onComplete,
}: {
  pendingActionId: string;
  summary: string;
  toolName?: string;
  onComplete?: (kind: "confirmed" | "cancelled" | "error") => void;
}) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<
    | { kind: "pending" }
    | { kind: "confirmed"; result: unknown }
    | { kind: "cancelled" }
    | { kind: "error"; message: string }
  >({ kind: "pending" });

  const executeMutation = useMutation({
    ...orpc.metaAds.executeMcpAction.mutationOptions(),
    onSuccess: (data) => {
      setState({ kind: "confirmed", result: data });
      toast.success("Ação executada");
      queryClient.invalidateQueries({ queryKey: ["metaAds"] });
      onComplete?.("confirmed");
    },
    onError: (err) => {
      const msg = (err as Error).message;
      setState({ kind: "error", message: msg });
      toast.error(msg);
      onComplete?.("error");
    },
  });

  const cancelMutation = useMutation({
    ...orpc.metaAds.cancelMcpAction.mutationOptions(),
    onSuccess: () => {
      setState({ kind: "cancelled" });
      toast.info("Ação cancelada");
      onComplete?.("cancelled");
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const isPendingCall = executeMutation.isPending || cancelMutation.isPending;

  if (state.kind === "confirmed") {
    return (
      <Card className="border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20">
        <CardContent className="p-3 flex items-start gap-2.5">
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 text-xs">
            <p className="font-medium">Ação executada</p>
            <p className="text-muted-foreground mt-0.5">{summary}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state.kind === "cancelled") {
    return (
      <Card className="border-muted bg-muted/30">
        <CardContent className="p-3 flex items-start gap-2.5 text-xs text-muted-foreground">
          <X className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">Ação cancelada</p>
            <p className="line-through opacity-70 mt-0.5">{summary}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state.kind === "error") {
    return (
      <Card className="border-red-500/40 bg-red-50/40 dark:bg-red-950/20">
        <CardContent className="p-3 flex items-start gap-2.5">
          <AlertTriangle className="size-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 text-xs">
            <p className="font-medium">Falha ao executar</p>
            <p className="text-muted-foreground mt-0.5">{state.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-300/60 bg-amber-50/30 dark:bg-amber-950/15">
      <CardContent className="p-3 space-y-2.5">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 text-xs">
            <p className="font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400 text-[10px]">
              Confirmação necessária
            </p>
            <p className="text-foreground mt-1">{summary}</p>
            {toolName && (
              <p className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                {toolName}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-200/40 dark:border-amber-900/40">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPendingCall}
            onClick={() => cancelMutation.mutate({ pendingActionId })}
            className="h-7 text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isPendingCall}
            onClick={() => executeMutation.mutate({ pendingActionId })}
            className="h-7 text-xs gap-1.5"
          >
            {executeMutation.isPending ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                Executando...
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3" />
                Confirmar
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
