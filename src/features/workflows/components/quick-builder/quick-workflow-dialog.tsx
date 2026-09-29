"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TriggerIcon } from "@/features/leads/components/lead-triggers/trigger-icon";
import { QuickWorkflowBuilder } from "./quick-workflow-builder";

// Construtor rápido num diálogo (spec 0039, RF-4): com lead, vale só para ele.

interface QuickWorkflowDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  trackingId: string;
  leadId?: string;
  leadName?: string;
}

export function QuickWorkflowDialog({ isOpen, onOpenChange, trackingId, leadId, leadName }: QuickWorkflowDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriggerIcon className="size-4" />
            {leadName ? `Novo gatilho · ${leadName}` : "Novo gatilho automático"}
          </DialogTitle>
          <DialogDescription>
            Descreva numa frase ou monte passo a passo. {leadName ? `Vale só para ${leadName}.` : "Vale para todos os leads do tracking."}
          </DialogDescription>
        </DialogHeader>
        {isOpen && (
          <QuickWorkflowBuilder trackingId={trackingId} leadId={leadId} leadName={leadName} onCreated={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
