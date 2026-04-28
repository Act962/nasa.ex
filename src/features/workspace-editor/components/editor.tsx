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
import { useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { workspaceNodeComponents } from "@/config/workspace-node-components";
import { NodeType } from "@/generated/prisma/enums";
import "@xyflow/react/dist/style.css";
import { Spinner } from "@/components/ui/spinner";
import { useSetAtom } from "jotai";
import { editorAtom } from "@/features/editor/store/atoms";
import { WsAddNodeButton } from "./add-node-button";
import { WsExecuteWorkflowButton } from "./execute-workflow-button";
import { WsNodeSelector } from "@/features/workspace-executions/components/node-selector";
import { WsMenuOptions } from "./menu-options";

export function WorkspaceEditor({ workflowId }: { workflowId: string }) {
  const [openSelector, setOpenSelector] = useState(false);
  const { data } = useSuspenseQuery(
    orpc.workspaceWorkflow.getOne.queryOptions({ input: { workflowId } }),
  );

  const setEditor = useSetAtom(editorAtom);
  const [nodes, setNodes] = useState<Node[]>(data.nodes);
  const [edges, setEdges] = useState<Edge[]>(data.edges);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((snap) => applyNodeChanges(changes, snap)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((snap) => applyEdgeChanges(changes, snap)),
    [],
  );
  const onConnect = useCallback(
    (params: Connection) => setEdges((snap) => addEdge(params, snap)),
    [],
  );

  const hasManualTrigger = useMemo(
    () =>
      nodes.some((n) => n.type === NodeType.WS_MANUAL_TRIGGER),
    [nodes],
  );

  return (
    <div className="size-full">
      <WsMenuOptions
        handelOpenSelector={setOpenSelector}
        workflowId={workflowId}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={workspaceNodeComponents}
          onInit={setEditor}
          fitView
          snapGrid={[10, 10]}
          snapToGrid
        >
          <Background variant={BackgroundVariant.Dots} />
          <MiniMap position="bottom-right" className="bg-background!" />
          <Controls
            position="bottom-left"
            className="bg-background! text-black!"
          />
          <Panel position="top-right">
            <WsAddNodeButton />
          </Panel>
          {hasManualTrigger && (
            <Panel position="bottom-center">
              <WsExecuteWorkflowButton workflowId={workflowId} />
            </Panel>
          )}
          <WsNodeSelector
            open={openSelector}
            onOpenChange={setOpenSelector}
          />
        </ReactFlow>
      </WsMenuOptions>
    </div>
  );
}

export function WorkspaceEditorLoading() {
  return (
    <div className="size-full flex items-center justify-center gap-2">
      <Spinner />
      <span>Carregando...</span>
    </div>
  );
}
