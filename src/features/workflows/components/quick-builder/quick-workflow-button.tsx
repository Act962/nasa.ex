"use client";

import { useAutomationPermissions } from "@/features/workflows/hooks/use-automation-permissions";
import { useState } from "react";
import { ZapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickWorkflowDialog } from "./quick-workflow-dialog";

// "Modo rápido" na página de Gatilhos Automáticos (spec 0039, RF-4).
export function QuickWorkflowButton({ trackingId }: { trackingId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { canCreate } = useAutomationPermissions();
  if (!canCreate) return null;
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <ZapIcon className="size-4" />
        <span className="hidden sm:inline">Modo rápido</span>
      </Button>
      <QuickWorkflowDialog isOpen={isOpen} onOpenChange={setIsOpen} trackingId={trackingId} />
    </>
  );
}
