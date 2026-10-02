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
  RedoIcon,
  TriangleAlertIcon,
  UndoIcon,
} from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useFormAutosave } from "@/features/form/hooks/use-form-autosave";
import { format } from "date-fns";

/**
 * Mostra o status do auto-save e expõe os botões de undo/redo no header do
 * builder. Substitui (ou complementa) o botão "Salvar" manual.
 */
export function BuilderSaveStatus({ isCompact = false }: { isCompact?: boolean } = {}) {
  const { undo, redo, canUndo, canRedo } = useBuilderStore();
  const { status, lastSavedAt } = useFormAutosave();

  const undoEnabled = canUndo();
  const redoEnabled = canRedo();

  // Compacto (celular): o Desfazer já está no dock — fica só o status, em ícone.
  if (isCompact) return <StatusPill status={status} lastSavedAt={lastSavedAt} isCompact />;

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
  isCompact = false,
}: {
  status: ReturnType<typeof useFormAutosave>["status"];
  lastSavedAt: Date | null;
  isCompact?: boolean;
}) {
  const labelClassName = isCompact ? "sr-only" : undefined;
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground px-2">
        <OrbitaSpinner className="size-3 " />
        <span className={labelClassName}>Salvando…</span>
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-destructive px-2">
        <TriangleAlertIcon className="size-3" />
        <span className={labelClassName}>Erro ao salvar</span>
      </span>
    );
  }
  if (status === "saved" && lastSavedAt) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-success px-2">
        <CheckCircle2Icon className="size-3" />
        <span className={labelClassName}>Salvo {format(lastSavedAt, "HH:mm")}</span>
      </span>
    );
  }
  if (status === "dirty") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground px-2">
        <CircleDashedIcon className="size-3" />
        <span className={labelClassName}>Não salvo</span>
      </span>
    );
  }
  return null;
}
