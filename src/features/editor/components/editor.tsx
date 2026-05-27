"use client";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { createId } from "@paralleldrive/cuid2";
import { toast } from "sonner";

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
import { triggerNodes } from "@/features/executions/lib/node-options";

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

  // Quando o usuário cria a automação via Cmd+K → "Automatizar", o palette
  // navega pra cá com `?addNode=<NODE_TYPE>`. Aqui adicionamos esse nó
  // automaticamente conectado ao INITIAL, e limpamos a query string pra
  // não duplicar em re-renders.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const addNodeApplied = useRef(false);

  useEffect(() => {
    if (addNodeApplied.current) return;
    const addNodeParam = searchParams.get("addNode");
    if (!addNodeParam) return;
    // Valida que é um NodeType conhecido (evita injection via URL)
    if (!(addNodeParam in NodeType)) {
      addNodeApplied.current = true;
      return;
    }

    addNodeApplied.current = true;
    const nodeType = addNodeParam as keyof typeof NodeType;
    const isTrigger = triggerNodes.some((t) => t.type === NodeType[nodeType]);

    setNodes((current) => {
      // Se for trigger, só pode 1 — checa duplicação
      if (isTrigger) {
        const hasTrigger = current.some((n) =>
          triggerNodes.some((t) => t.type === n.type),
        );
        if (hasTrigger && current.some((n) => n.type === NodeType.INITIAL)) {
          // Substitui o INITIAL pelo trigger escolhido
          const newId = createId();
          const initial = current.find((n) => n.type === NodeType.INITIAL);
          return [
            ...current.filter((n) => n.type !== NodeType.INITIAL),
            {
              id: newId,
              data: {},
              position: initial?.position ?? { x: 0, y: 0 },
              type: NodeType[nodeType],
            },
          ];
        }
        if (hasTrigger) {
          toast.error("Apenas um gatilho é permitido por workflow.");
          return current;
        }
      }

      // Action ou send-to-app — adiciona node novo abaixo do INITIAL
      const initial = current.find((n) => n.type === NodeType.INITIAL);
      const newId = createId();
      const newNode: Node = {
        id: newId,
        data: {},
        position: {
          x: (initial?.position.x ?? 0) + 250,
          y: initial?.position.y ?? 0,
        },
        type: NodeType[nodeType],
      };

      // Conecta automaticamente se houver INITIAL
      if (initial) {
        setEdges((edgesPrev) => [
          ...edgesPrev,
          {
            id: createId(),
            source: initial.id,
            target: newId,
            sourceHandle: "source-1",
            targetHandle: "target-1",
          },
        ]);
      }

      return [...current, newNode];
    });

    // Limpa a query string sem reloadar a página
    const params = new URLSearchParams(searchParams.toString());
    params.delete("addNode");
    const newUrl = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname;
    router.replace(newUrl, { scroll: false });

    toast.success(
      "Nó adicionado — clique nele pra configurar e depois salve o workflow.",
    );
  }, [searchParams, pathname, router]);

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
