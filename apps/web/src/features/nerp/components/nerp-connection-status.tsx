"use client";

import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useNerpConnection,
  useTestNerpConnection,
} from "@/features/nerp/hooks/use-nerp-connection";

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("pt-BR");
}

export function NerpConnectionStatus() {
  const conn = useNerpConnection();
  const ping = useTestNerpConnection();

  if (!conn.connected) return null;

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase text-muted-foreground">
            Org nerp
          </div>
          <div className="font-mono text-xs">{conn.nerpOrgId ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground">
            Escopos
          </div>
          <div className="text-xs">
            {conn.scopes.length ? conn.scopes.join(", ") : "—"}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1 text-xs uppercase text-muted-foreground">
            <Clock className="size-3" /> Último sync
          </div>
          <div className="text-xs">{formatDate(conn.lastSyncAt)}</div>
        </div>
        <div>
          <div className="flex items-center gap-1 text-xs uppercase text-muted-foreground">
            {conn.lastErrorAt ? (
              <AlertTriangle className="size-3 text-destructive" />
            ) : (
              <CheckCircle2 className="size-3 text-emerald-600" />
            )}
            Último erro
          </div>
          <div className="text-xs">
            {conn.lastErrorAt ? formatDate(conn.lastErrorAt) : "Nenhum"}
          </div>
        </div>
      </div>

      {conn.lastErrorMessage && (
        <div className="rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          {conn.lastErrorMessage}
        </div>
      )}

      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            ping.mutate(undefined, {
              onSuccess: (data) => toast.success(`Conectado a ${data.org.name}`),
              onError: (err: Error) =>
                toast.error(err.message || "Falha ao testar conexão nerp"),
            })
          }
          disabled={ping.isPending}
        >
          {ping.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="size-3.5" />
          )}
          Testar conexão
        </Button>
      </div>
    </div>
  );
}
