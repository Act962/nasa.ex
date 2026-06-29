"use client";

import { CheckIcon, Loader2Icon } from "lucide-react";
import { useOrgLayout } from "@/features/insights/context/org-layout-provider";
import { cn } from "@/lib/utils";

/**
 * Toolbar minimal de status de salvamento. Antes mostrava hint de drag e
 * botão de restaurar, mas:
 *  - Botão de restaurar foi pra SettingsPanel (Configurações)
 *  - Hint de drag foi removido pra não poluir o topo do dashboard
 *
 * Agora só renderiza quando há status de save pra mostrar — fica
 * invisível 99% do tempo.
 */
export function LayoutEditToolbar() {
  const { canEdit, saveStatus } = useOrgLayout();

  if (!canEdit || saveStatus === "idle") return null;

  return (
    <div className="flex items-center rounded-lg border border-dashed bg-muted/30 px-3 py-2">
      <SaveIndicator status={saveStatus} />
    </div>
  );
}

function SaveIndicator({
  status,
}: {
  status: "idle" | "saving" | "saved" | "error";
}) {
  if (status === "idle") return null;
  return (
    <div
      className={cn(
        "flex items-center gap-1 text-xs",
        status === "saving" && "text-muted-foreground",
        status === "saved" && "text-emerald-600",
        status === "error" && "text-red-600",
      )}
    >
      {status === "saving" && (
        <>
          <Loader2Icon className="size-3 animate-spin" />
          <span>Salvando...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <CheckIcon className="size-3" />
          <span>Salvo</span>
        </>
      )}
      {status === "error" && <span>Erro ao salvar</span>}
    </div>
  );
}
