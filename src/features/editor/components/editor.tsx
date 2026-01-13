"use client";
import { useState, useCallback } from "react";
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

export function Editor({ workflowId }: { workflowId: string }) {
  const { data } = useSuspenseQuery(
    orpc.workflow.getOne.queryOptions({
      input: {
        workflowId,
      },
    })
  );

  const [nodes, setNodes] = useState<Node[]>(data.nodes);
  const [edges, setEdges] = useState<Edge[]>(data.edges);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    []
  );
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    []
  );

  return (
    <div className="size-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeComponents}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} />
        <MiniMap position="bottom-left" className="bg-background!" />
        <Controls
          position="bottom-right"
          className="bg-background! text-black!"
        />
        <Panel position="top-right">
          <AddNodeButton />
        </Panel>
      </ReactFlow>
    </div>
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
