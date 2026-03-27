"use client";
import { useState, useCallback, useMemo } from "react";

import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  NodeChange,
  EdgeChange,
  Connection,
  Background,
  MiniMap,
  Controls,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import { orpc } from "@/lib/orpc";
import { useSuspenseQuery } from "@tanstack/react-query";

import "@xyflow/react/dist/style.css";
import { Spinner } from "@/components/ui/spinner";
import { nodeComponents } from "@/config/node-components";
import { AddNodeButton } from "./add-node-button";
import { useSetAtom } from "jotai";
import { editorAtom } from "../store/atoms";
import { NodeType } from "@/generated/prisma/enums";
import { ExecuteWorkflowButton } from "./execute-workflow-button";
import { NodeSelector } from "@/components/node-selector";
import { MenuOptions } from "../../../components/menu-options";

export function Editor({ workflowId }: { workflowId: string }) {
  const [openSelector, setOpenSelector] = useState(false);

  const { data } = useSuspenseQuery(
    orpc.workflow.getOne.queryOptions({
      input: {
        workflowId,
      },
    }),
  );

  const setEditor = useSetAtom(editorAtom);

  const [nodes, setNodes] = useState<Node[]>(data.nodes);
  const [edges, setEdges] = useState<Edge[]>(data.edges);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    [],
  );
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    [],
  );

  const hasManuelTrigger = useMemo(() => {
    return nodes.some((node) => node.type === NodeType.MANUAL_TRIGGER);
  }, [nodes]);

  return (
    <>
      <div className="size-full">
        <MenuOptions
          handelOpenSelector={setOpenSelector}
          workflowId={workflowId}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeComponents}
            onInit={setEditor}
            fitView
            snapGrid={[10, 10]}
            snapToGrid
            // panOnScroll
            // panOnDrag={false}
            // selectionOnDrag
          >
            <Background variant={BackgroundVariant.Dots} />
            <MiniMap position="bottom-right" className="bg-background!" />
            <Controls
              position="bottom-left"
              className="bg-background! text-black!"
            />
            <Panel position="top-right">
              <AddNodeButton />
            </Panel>
            {hasManuelTrigger && (
              <Panel position="bottom-center">
                <ExecuteWorkflowButton workflowId={workflowId} />
              </Panel>
            )}
            <NodeSelector open={openSelector} onOpenChange={setOpenSelector} />
          </ReactFlow>
        </MenuOptions>
      </div>

      {/* <NodeSelector open={openSelector} onOpenChange={setOpenSelector} /> */}
    </>
  );
}

export function EditorLoading() {
  return (
    <div className="size-full flex items-center justify-center gap-2">
      <Spinner />
      <span>Carregando...</span>
    </div>
  );
}
