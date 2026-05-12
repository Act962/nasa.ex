"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface OthersTableItem {
  name: string;
  count: number;
  leadIds: string[];
  fill: string;
}

interface OthersTableProps {
  items: OthersTableItem[];
  total: number;
  onClick?: (leadIds?: string[]) => void;
}

export function OthersTable({ items, total, onClick }: OthersTableProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-full gap-1 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        {expanded ? "Ver menos" : `Ver todos (${items.length} itens ocultos)`}
      </Button>

      {expanded && (
        <div className="mt-1 max-h-50 overflow-y-auto rounded-md border">
          {items.map((item, i) => {
            const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
            return (
              <div
                key={i}
                className={`flex items-center gap-2 border-b px-3 py-2 text-xs last:border-0 ${
                  onClick ? "cursor-pointer hover:bg-muted/50" : ""
                }`}
                onClick={() => onClick?.(item.leadIds)}
              >
                <div
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.fill }}
                />
                <span className="flex-1 truncate">{item.name}</span>
                <span className="w-8 text-right font-mono text-muted-foreground">
                  {item.count}
                </span>
                <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: item.fill }}
                  />
                </div>
                <span className="w-8 text-right text-muted-foreground">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
