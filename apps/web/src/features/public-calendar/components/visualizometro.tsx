"use client";

import { Eye } from "lucide-react";

export function Visualizometro({ count }: { count: number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card px-3 py-1.5 text-sm">
      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="font-semibold tabular-nums">
        {count.toLocaleString("pt-BR")}
      </span>
      <span className="text-xs text-muted-foreground">
        visualização{count === 1 ? "" : "es"}
      </span>
    </div>
  );
}
