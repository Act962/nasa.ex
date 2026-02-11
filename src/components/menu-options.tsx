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
  NodeTypeOption,
} from "@/features/executions/lib/node-options";

export function MenuOptions({
  children,
  handelOpenSelector,
}: {
  children: React.ReactNode;
  handelOpenSelector: (open: boolean) => void;
}) {
  const editor = useAtomValue(editorAtom);

  const handleNodeSelect = useCallback(
    (selection: NodeTypeOption) => {
      if (!editor) return;

      const { setNodes, screenToFlowPosition } = editor;
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
            Adicionar
          </ContextMenuItem>
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
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}
