"use client";

import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { useCommentsConnection } from "@/features/comments/hooks/use-comments-connection";

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("pt-BR");
}

export function CommentsConnectionStatus() {
  const conn = useCommentsConnection();

  if (!conn.connected) return null;

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase text-muted-foreground">
            User comments
          </div>
          <div className="font-mono text-xs">{conn.userId ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground">Escopos</div>
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
    </div>
  );
}
