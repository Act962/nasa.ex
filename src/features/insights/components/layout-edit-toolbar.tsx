"use client";

import { CheckIcon, GripVerticalIcon, Loader2Icon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrgLayout } from "@/features/insights/context/org-layout-provider";
import { cn } from "@/lib/utils";

export function LayoutEditToolbar() {
  const { canEdit, saveStatus, resetLayout } = useOrgLayout();

  if (!canEdit) return null;

  return (
    <div className="flex items-center justify-between rounded-lg border border-dashed bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <GripVerticalIcon className="size-3.5" />
          <span>Arraste os blocos para reorganizar</span>
        </div>
        <SaveIndicator status={saveStatus} />
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={resetLayout}
        className="text-xs"
      >
        <RotateCcwIcon className="size-3 mr-1" />
        Restaurar layout padrão
      </Button>
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
