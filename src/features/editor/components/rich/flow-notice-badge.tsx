"use client";

import { TriangleAlertIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { WorkflowNodeNotice } from "@/components/workflow-node";
import { outlineToneColor } from "./animated-outline";

// Alerta no canto do quadro na visão "Visual" (spec 0090): o aviso completo abre ao clicar,
// em vez de ocupar espaço embaixo do quadro.

export function FlowNoticeBadge({ notice, onFix }: { notice: WorkflowNodeNotice; onFix?: () => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={notice.title}
          className="nodrag nopan absolute -right-4 -top-4 z-10 grid size-8 place-items-center rounded-full text-white shadow-md transition-transform hover:scale-110"
          style={{ backgroundColor: outlineToneColor("problem") }}
          onClick={(event) => event.stopPropagation()}
        >
          <TriangleAlertIcon className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-64 text-xs leading-snug">
        <p className="font-semibold text-destructive">{notice.title}</p>
        <p className="mt-1 text-foreground/90">{notice.message}</p>
        {notice.fixHint && onFix && (
          <button type="button" onClick={onFix} className="mt-2 font-semibold text-primary hover:underline">
            {notice.fixHint}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
