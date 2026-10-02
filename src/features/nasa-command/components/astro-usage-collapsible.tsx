"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Seção do painel de uso que nasce retraída; o painel mantém só uma aberta por vez. */
export function AstroUsageCollapsibleSection({
  title,
  summary,
  isOpen,
  onToggle,
  isFirst = false,
  children,
}: {
  title: ReactNode;
  /** Resumo de uma linha mostrado com a seção fechada. */
  summary?: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  isFirst?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cn(!isFirst && "border-t border-line")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-muted-foreground">{title}</span>
          {!isOpen && summary && <span className="mt-0.5 block truncate text-[12.5px] text-foreground">{summary}</span>}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
      </button>
      {isOpen && <div className="animate-in fade-in slide-in-from-top-1 pb-3 duration-200">{children}</div>}
    </section>
  );
}
