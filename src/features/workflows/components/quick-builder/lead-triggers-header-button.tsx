"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { LightRunBorder } from "@/features/leads/components/lead-triggers/light-run-border";
import { TriggerIcon } from "@/features/leads/components/lead-triggers/trigger-icon";
import { QuickWorkflowDialog } from "./quick-workflow-dialog";

// "Gatilhos do lead" no topo do chat (spec 0039): abre o criar gatilho — para o
// lead da conversa aberta ou, sem conversa, para o tracking inteiro.

interface LeadTriggersHeaderButtonProps {
  trackingId: string;
  leadId?: string;
  leadName?: string;
  compact?: boolean;
  className?: string;
}

export function LeadTriggersHeaderButton({ trackingId, leadId, leadName, compact, className }: LeadTriggersHeaderButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  if (!trackingId) return null;
  return (
    <>
      <LightRunBorder tone="run" className={cn("rounded-full", className)} innerClassName="rounded-full bg-background">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title="Gatilhos do lead"
          className={cn(
            "flex items-center gap-1.5 rounded-full text-sm font-medium transition-colors hover:bg-muted",
            compact ? "size-8 justify-center" : "h-8 px-3",
          )}
        >
          <TriggerIcon className="size-4" isSpinning />
          {!compact && "Gatilhos do lead"}
        </button>
      </LightRunBorder>
      <QuickWorkflowDialog isOpen={isOpen} onOpenChange={setIsOpen} trackingId={trackingId} leadId={leadId} leadName={leadName} />
    </>
  );
}
