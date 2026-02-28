"use client";

import { useAtomValue } from "jotai";
import { editorAtom } from "../features/editor/store/atoms";
import { useCallback } from "react";
import { createId } from "@paralleldrive/cuid2";
import { NodeType } from "@/generated/prisma/enums";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  executionNodes,
  triggerNodes,
  NodeTypeOption,
} from "@/features/executions/lib/node-options";
import { toast } from "sonner";
import { useUpdateWorkflow } from "@/features/workflows/hooks/use-workflows";
import { PlusIcon, SaveIcon, WorkflowIcon } from "lucide-react";

export function MenuOptions({
  children,
  handelOpenSelector,
  workflowId,
}: {
  children: React.ReactNode;
  handelOpenSelector: (open: boolean) => void;
  workflowId: string;
}) {
  const editor = useAtomValue(editorAtom);
  const saveWorkflow = useUpdateWorkflow();

  const handleSave = () => {
    if (!editor) return;

    const nodes = editor.getNodes();
    const edges = editor.getEdges();

    saveWorkflow.mutate({
      id: workflowId,
      nodes,
      edges,
    });
  };

  const handleNodeSelect = useCallback(
    (selection: NodeTypeOption) => {
      if (!editor) return;
      const { setNodes, getNodes, screenToFlowPosition } = editor;

      if (selection.category === "trigger") {
        const nodes = getNodes();
        const hasTrigger = nodes.some((node) =>
          triggerNodes.some((tn) => tn.type === node.type),
        );

        if (hasTrigger) {
          toast.error("Apenas um gatilho é permitido por workflow.");
          return;
        }
      }

      const newNodeId = createId();

      setNodes((nodes) => {
        const hasInitialTrigger = nodes.some(
          (node) => node.type === NodeType.INITIAL,
        );

        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        const flowPostion = screenToFlowPosition({
          x: centerX + (Math.random() - 0.5) * 200,
          y: centerY + (Math.random() - 0.5) * 200,
        });

        const newNode = {
          id: newNodeId,
          data: {},
          position: flowPostion,
          type: selection.type,
        };

        if (hasInitialTrigger) {
          return [newNode];
        }

        return [...nodes, newNode];
      });
    },
    [editor, handelOpenSelector],
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuGroup>
          <ContextMenuItem
            onClick={() => handelOpenSelector(true)}
            className="cursor-pointer"
          >
            <PlusIcon />
            Adicionar
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>Gatilhos</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuGroup>
                {triggerNodes.map((nodeType) => (
                  <ContextMenuItem
                    key={nodeType.type}
                    onClick={() => handleNodeSelect(nodeType)}
                    className="cursor-pointer"
                  >
                    <nodeType.icon className="size-4" />
                    {nodeType.label}
                  </ContextMenuItem>
                ))}
              </ContextMenuGroup>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSub>
            <ContextMenuSubTrigger>Ações</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuGroup>
                {executionNodes.map((nodeType) => (
                  <ContextMenuItem
                    key={nodeType.type}
                    onClick={() => handleNodeSelect(nodeType)}
                    className="cursor-pointer"
                  >
                    <nodeType.icon className="size-4" />
                    {nodeType.label}
                  </ContextMenuItem>
                ))}
              </ContextMenuGroup>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuItem
            onClick={handleSave}
            className="cursor-pointer"
            disabled={saveWorkflow.isPending}
          >
            <SaveIcon />
            Salvar
          </ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}
