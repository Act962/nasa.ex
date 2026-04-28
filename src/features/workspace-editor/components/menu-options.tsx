"use client";

import { useAtomValue } from "jotai";
import { editorAtom } from "@/features/editor/store/atoms";
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
  wsExecutionNodes,
  wsTriggerNodes,
  WsNodeTypeOption,
} from "@/features/workspace-executions/lib/node-options";
import { toast } from "sonner";
import { useUpdateWorkspaceWorkflow } from "../hooks/use-workspace-workflows";
import { PlusIcon, SaveIcon } from "lucide-react";

export function WsMenuOptions({
  children,
  handelOpenSelector,
  workflowId,
}: {
  children: React.ReactNode;
  handelOpenSelector: (open: boolean) => void;
  workflowId: string;
}) {
  const editor = useAtomValue(editorAtom);
  const save = useUpdateWorkspaceWorkflow();

  const handleSave = () => {
    if (!editor) return;
    save.mutate({
      id: workflowId,
      nodes: editor.getNodes(),
      edges: editor.getEdges(),
    });
  };

  const handleNodeSelect = useCallback(
    (selection: WsNodeTypeOption) => {
      if (!editor) return;
      const { setNodes, getNodes, screenToFlowPosition } = editor;

      if (selection.category === "trigger") {
        const hasTrigger = getNodes().some((n) =>
          wsTriggerNodes.some((t) => t.type === n.type),
        );
        if (hasTrigger) {
          toast.error("Apenas um gatilho é permitido por workflow.");
          return;
        }
      }

      const newId = createId();
      setNodes((nodes) => {
        const hasInitial = nodes.some(
          (n) => n.type === NodeType.WS_INITIAL,
        );
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const pos = screenToFlowPosition({
          x: centerX + (Math.random() - 0.5) * 200,
          y: centerY + (Math.random() - 0.5) * 200,
        });
        const newNode = {
          id: newId,
          data: {},
          position: pos,
          type: selection.type,
        };
        return hasInitial ? [newNode] : [...nodes, newNode];
      });
    },
    [editor],
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
                {wsTriggerNodes.map((nodeType) => (
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
                {wsExecutionNodes.map((nodeType) => (
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
            disabled={save.isPending}
          >
            <SaveIcon />
            Salvar
          </ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}
