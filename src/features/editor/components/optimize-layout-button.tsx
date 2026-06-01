"use client";

import { useCallback } from "react";
import { LayoutTemplate } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { useSetAtom } from "jotai";
import { toast } from "sonner";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { workflowDirtyAtom } from "@/features/editor/store/atoms";
import { autoLayoutWorkflow } from "@/features/editor/lib/auto-layout";

/**
 * Botão "Otimizar visualização" do Panel top-right do canvas.
 *
 * Recalcula positions de TODOS os nós via Dagre (LR — esquerda → direita)
 * pra eliminar sobreposições e cruzamentos visuais. Útil em workflows
 * grandes (presets de 30 nós, fluxos gerados pela IA) que crescem fora
 * do layout original.
 *
 * Fluxo:
 *   1. Lê nodes/edges atuais via useReactFlow()
 *   2. Calcula novas positions via Dagre
 *   3. Aplica via setNodes() (instant — React Flow anima a transição)
 *   4. Marca workflow como dirty (user precisa salvar)
 *   5. fitView() centraliza o novo layout
 *
 * NÃO chama mutation oRPC direto — confia no botão "Salvar" existente
 * (EditorSaveButton) que persiste workflow.update.updateNodes.
 */
export function OptimizeLayoutButton() {
  const { getNodes, getEdges, setNodes, fitView } = useReactFlow();
  const setDirty = useSetAtom(workflowDirtyAtom);

  const handleOptimize = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();
    if (nodes.length === 0) {
      toast.info("Nada pra organizar — adicione alguns nós primeiro.");
      return;
    }

    try {
      const { nodes: laidOut } = autoLayoutWorkflow(nodes, edges, {
        direction: "LR",
        nodeSep: 80,
        rankSep: 160,
      });
      setNodes(laidOut);
      setDirty(true);
      // Aguarda 1 tick pra setNodes propagar antes do fitView, senão
      // ele centraliza nas positions ANTIGAS.
      setTimeout(() => {
        fitView({ padding: 0.15, duration: 600 });
      }, 50);
      toast.success(
        `Layout otimizado — ${nodes.length} nós reorganizados. Não esqueça de salvar.`,
      );
    } catch (err) {
      console.error("[optimize-layout]", err);
      toast.error(
        err instanceof Error
          ? `Falha ao otimizar: ${err.message}`
          : "Não consegui calcular o novo layout — tenta de novo ou reporta.",
      );
    }
  }, [getNodes, getEdges, setNodes, fitView, setDirty]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="sm" onClick={handleOptimize}>
          <LayoutTemplate className="size-4" />
          <span className="hidden md:inline ml-1.5">Organizar</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Otimizar visualização — reorganiza os nós pra eliminar sobreposições
        e cruzamentos (Dagre LR)
      </TooltipContent>
    </Tooltip>
  );
}
