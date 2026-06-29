"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import {
  CheckCircle2Icon,
  CircleDashedIcon,
  LoaderIcon,
  RedoIcon,
  TriangleAlertIcon,
  UndoIcon,
} from "lucide-react";
import { useFormAutosave } from "@/features/form/hooks/use-form-autosave";
import { format } from "date-fns";

/**
 * Mostra o status do auto-save e expõe os botões de undo/redo no header do
 * builder. Substitui (ou complementa) o botão "Salvar" manual.
 */
export function BuilderSaveStatus() {
  const { undo, redo, canUndo, canRedo } = useBuilderStore();
  const { status, lastSavedAt } = useFormAutosave();

  const undoEnabled = canUndo();
  const redoEnabled = canRedo();

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!undoEnabled}
            onClick={() => undo()}
            aria-label="Desfazer"
          >
            <UndoIcon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Desfazer (⌘/Ctrl+Z)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!redoEnabled}
            onClick={() => redo()}
            aria-label="Refazer"
          >
            <RedoIcon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Refazer (⌘/Ctrl+Shift+Z)</TooltipContent>
      </Tooltip>

      <StatusPill status={status} lastSavedAt={lastSavedAt} />
    </div>
  );
}

function StatusPill({
  status,
  lastSavedAt,
}: {
  status: ReturnType<typeof useFormAutosave>["status"];
  lastSavedAt: Date | null;
}) {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground px-2">
        <LoaderIcon className="size-3 animate-spin" />
        Salvando…
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-destructive px-2">
        <TriangleAlertIcon className="size-3" />
        Erro ao salvar
      </span>
    );
  }
  if (status === "saved" && lastSavedAt) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-emerald-600 px-2">
        <CheckCircle2Icon className="size-3" />
        Salvo {format(lastSavedAt, "HH:mm")}
      </span>
    );
  }
  if (status === "dirty") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground px-2">
        <CircleDashedIcon className="size-3" />
        Não salvo
      </span>
    );
  }
  return null;
}
