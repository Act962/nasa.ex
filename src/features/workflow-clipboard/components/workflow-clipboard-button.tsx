"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useReactFlow } from "@xyflow/react";
import {
  ClipboardCopy,
  ClipboardPaste,
  Copy,
  Download,
  FileUp,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  useExportNodes,
  useExportWorkflow,
} from "../hooks/use-workflow-clipboard-api";
import { useWorkflowClipboard } from "../hooks/use-workflow-clipboard";
import { clipboardFileName } from "../lib/ref-catalog";
import type { BlueprintV2 } from "../lib/types";
import { WorkflowImportMappingDialog } from "./import-mapping-dialog";

interface Props {
  workflowId: string;
  /** Tracking atual — pré-selecionado no dialog de import. */
  trackingId?: string;
}

/**
 * Dropdown unificado pro fluxo de copy/paste/export/import de workflow.
 * Também registra atalhos Cmd+C / Cmd+V quando o canvas está focado.
 *
 * Estados visuais:
 *   - "Colar" só fica habilitado quando há blueprint no clipboard
 *   - "Copiar selecionados" só aparece quando há nodes selecionados
 *   - Após copiar, mostra badge transient "✓ copiado"
 */
export function WorkflowClipboardButton({ workflowId, trackingId }: Props) {
  const { getNodes } = useReactFlow();
  const exportFull = useExportWorkflow();
  const exportSel = useExportNodes();
  const {
    hasClipboard,
    writeBlueprint,
    readBlueprint,
    clearClipboard,
    exportAsFile,
    importFromFile,
  } = useWorkflowClipboard();

  const [pendingPaste, setPendingPaste] = useState<BlueprintV2 | null>(null);
  const [recentlyCopied, setRecentlyCopied] = useState(false);

  // Conta nodes selecionados pra mostrar o item do dropdown
  const [selectedCount, setSelectedCount] = useState(0);
  useEffect(() => {
    // Re-checa selecionados ao abrir/fechar — usado pelo trigger
    const id = setInterval(() => {
      setSelectedCount(getNodes().filter((n) => n.selected).length);
    }, 500);
    return () => clearInterval(id);
  }, [getNodes]);

  const handleCopyWorkflow = useCallback(async () => {
    try {
      const data = await exportFull.mutateAsync({ workflowId });
      await writeBlueprint(data.blueprint);
      setRecentlyCopied(true);
      setTimeout(() => setRecentlyCopied(false), 2000);
      const brokenWarning =
        data.brokenRefs && data.brokenRefs.length > 0
          ? ` (${data.brokenRefs.length} refs quebradas — entidades não existem mais)`
          : "";
      toast.success(`Workflow copiado pro clipboard${brokenWarning}`);
    } catch (err) {
      toast.error(`Falha ao copiar: ${(err as Error).message}`);
    }
  }, [exportFull, workflowId, writeBlueprint]);

  const handleCopySelection = useCallback(async () => {
    const selected = getNodes().filter((n) => n.selected);
    if (selected.length === 0) {
      toast.error("Nenhum nó selecionado");
      return;
    }
    try {
      const data = await exportSel.mutateAsync({
        workflowId,
        nodeIds: selected.map((n) => n.id),
      });
      await writeBlueprint(data.blueprint);
      setRecentlyCopied(true);
      setTimeout(() => setRecentlyCopied(false), 2000);
      toast.success(`${selected.length} nó(s) copiados pro clipboard`);
    } catch (err) {
      toast.error(`Falha ao copiar: ${(err as Error).message}`);
    }
  }, [exportSel, getNodes, workflowId, writeBlueprint]);

  const handlePaste = useCallback(async () => {
    const blueprint = await readBlueprint();
    if (!blueprint) {
      toast.error("Nenhum workflow no clipboard");
      return;
    }
    setPendingPaste(blueprint);
  }, [readBlueprint]);

  const handleDownload = useCallback(async () => {
    try {
      const data = await exportFull.mutateAsync({ workflowId });
      exportAsFile(
        data.blueprint,
        clipboardFileName(
          data.blueprint.source.workflowName ?? "workflow",
          new Date(),
        ),
      );
      toast.success("JSON baixado");
    } catch (err) {
      toast.error(`Falha ao exportar: ${(err as Error).message}`);
    }
  }, [exportFull, workflowId, exportAsFile]);

  const handleImportFile = useCallback(async () => {
    const blueprint = await importFromFile();
    if (blueprint) {
      setPendingPaste(blueprint);
    }
  }, [importFromFile]);

  // ── Atalhos Cmd+C / Cmd+V ──────────────────────────────────────
  // Só dispara quando o foco não está em input/textarea/contenteditable
  // pra não conflitar com texto.
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.key === "c" || e.key === "C") {
        const selected = getNodes().filter((n) => n.selected);
        if (selected.length > 0) {
          e.preventDefault();
          await handleCopySelection();
        } else {
          // Cmd+C sem seleção = copia workflow inteiro (sinaliza intent)
          // pro user. Disable comportamento default de copiar texto vazio.
          e.preventDefault();
          await handleCopyWorkflow();
        }
      } else if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        await handlePaste();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [getNodes, handleCopySelection, handleCopyWorkflow, handlePaste]);

  const busy =
    exportFull.isPending || exportSel.isPending;

  return (
    <>
      <TooltipProvider>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : recentlyCopied ? (
                    <Sparkles className="size-3.5 text-emerald-500" />
                  ) : (
                    <ClipboardCopy className="size-3.5" />
                  )}
                  Clipboard
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              Copiar / colar workflow (Cmd+C / Cmd+V)
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Copiar
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={handleCopyWorkflow} disabled={busy}>
              <Copy className="size-3.5" />
              Copiar workflow inteiro
              <kbd className="ml-auto text-[10px] text-muted-foreground">
                ⌘C
              </kbd>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleCopySelection}
              disabled={busy || selectedCount === 0}
            >
              <Copy className="size-3.5" />
              Copiar {selectedCount} selecionado(s)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownload} disabled={busy}>
              <Download className="size-3.5" />
              Exportar como arquivo .json
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Colar
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={handlePaste}
              disabled={!hasClipboard}
            >
              <ClipboardPaste className="size-3.5" />
              Colar do clipboard
              <kbd className="ml-auto text-[10px] text-muted-foreground">
                ⌘V
              </kbd>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleImportFile}>
              <FileUp className="size-3.5" />
              Importar arquivo .json
            </DropdownMenuItem>
            {hasClipboard && (
              <DropdownMenuItem
                onClick={() => {
                  clearClipboard();
                  toast.success("Clipboard limpo");
                }}
                className="text-muted-foreground"
              >
                <Trash2 className="size-3.5" />
                Limpar clipboard
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>

      {pendingPaste && (
        <WorkflowImportMappingDialog
          open={!!pendingPaste}
          onOpenChange={(open) => {
            if (!open) setPendingPaste(null);
          }}
          blueprint={pendingPaste}
          // Se for selection, pergunta workflow alvo (atual);
          // se for full-workflow, pergunta tracking.
          targetWorkflowId={
            pendingPaste.kind === "node-selection" ? workflowId : undefined
          }
          defaultTargetTrackingId={trackingId}
          onImported={({ workflowId: createdId, nodesCreated }) => {
            // Pra append-nodes, reload do canvas atual via reload da
            // página (mais simples que invalidar query da árvore inteira).
            if (pendingPaste.kind === "node-selection") {
              setTimeout(() => window.location.reload(), 500);
            } else {
              // Cria workflow novo — navega pro editor dele.
              setTimeout(() => {
                window.location.href = `/workflow/${createdId}`;
              }, 800);
            }
          }}
        />
      )}
    </>
  );
}
