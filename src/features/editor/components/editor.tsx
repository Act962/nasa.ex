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
import { useAtomValue, useSetAtom } from "jotai";
import {
  editorAtom,
  lastSavedSnapshotAtom,
  workflowDirtyAtom,
} from "../store/atoms";
import { NodeType } from "@/generated/prisma/enums";
import { ExecuteWorkflowButton } from "./execute-workflow-button";
import { NodeSelector } from "@/components/node-selector";
import { MenuOptions } from "../../../components/menu-options";
import { triggerNodes } from "@/features/executions/lib/node-options";
import { WorkflowAgentModeProvider } from "@/features/workflows/lib/agent-mode-context";
import { DryRunButton } from "@/features/workflows/components/dry-run-button";
import { AgentDetailButton } from "@/features/workflows/components/agent-detail-button";
import { StepByStepContainer } from "./step-by-step-container";
import { RateLimitBadge } from "@/features/workflows/components/rate-limit-badge";
import { WorkflowIssuesPanel } from "@/features/workflows/components/workflow-issues-panel";
import { WorkflowIssuesProvider } from "@/features/workflows/components/workflow-issues-context";
import { useWorkflowValidation } from "@/features/workflows/hooks/use-workflow-validation";
import type { GraphIssue } from "@/features/workflows/lib/validate-workflow-graph";
import { ValidatedEdge } from "./validated-edge";

const edgeTypes = {
  // Edge default ganha validação automática — quando algum endpoint tem
  // erro, a linha pulsa em vermelho. Outras edges (sem type explícito)
  // herdam essa por ser o default no React Flow.
  default: ValidatedEdge,
};

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
  const setLastSavedSnapshot = useSetAtom(lastSavedSnapshotAtom);
  const setDirty = useSetAtom(workflowDirtyAtom);

  const [nodes, setNodes] = useState<Node[]>(data.nodes);
  const [edges, setEdges] = useState<Edge[]>(data.edges);

  // ── Detecção de alterações não salvas ────────────────────────────
  // Compara snapshot atual com o último salvo (atom compartilhado com o
  // save button). Quando difere → marca dirty pra:
  //   1. Breadcrumb "Automações" interceptar clique e mostrar dialog
  //   2. beforeunload alertar no refresh/close do navegador
  //
  // Snapshot inclui só campos relevantes (id, type, position, data) —
  // ignora campos voláteis como `selected`/`dragging` que React Flow
  // muda em cada hover e gerariam falso positivo de dirty.
  const computeSignature = useCallback(
    (ns: Node[], es: Edge[]): string => {
      const cleanNodes = ns.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      }));
      const cleanEdges = es.map((e) => ({
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      }));
      return JSON.stringify({ nodes: cleanNodes, edges: cleanEdges });
    },
    [],
  );

  // Snapshot inicial (= dados do servidor) só na 1ª render.
  useEffect(() => {
    setLastSavedSnapshot(computeSignature(data.nodes, data.edges));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-checa dirty toda vez que nodes/edges mudam. Lê snapshot via store
  // pra refletir reset após save (sem precisar de prop drilling).
  const lastSavedSnapshot = useAtomValue(lastSavedSnapshotAtom);
  useEffect(() => {
    if (!lastSavedSnapshot) return; // ainda não tem baseline (mount inicial)
    const current = computeSignature(nodes, edges);
    const isDirty = current !== lastSavedSnapshot;
    setDirty(isDirty);
    // Mirror em sessionStorage pra `beforeunload` ler sem closure stale.
    // SessionStorage some no fechar da aba — não vaza dado.
    sessionStorage.setItem("__wf_dirty", JSON.stringify(isDirty));
  }, [nodes, edges, lastSavedSnapshot, computeSignature, setDirty]);

  // beforeunload — refresh/fechar aba mostra dialog nativo do navegador.
  // Chrome ignora string custom em modernos, mas exige `returnValue`.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const dirty = JSON.parse(
        sessionStorage.getItem("__wf_dirty") ?? "false",
      );
      if (!dirty) return;
      e.preventDefault();
      e.returnValue =
        "Você fez alterações na automação. Deseja sair sem salvar?";
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      // Limpa flag ao desmontar (navegação dentro do app sai do editor)
      sessionStorage.removeItem("__wf_dirty");
    };
  }, []);

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

  // Provider envolve tudo — qualquer NodeSelector renderizado embaixo
  // (botão "+" no canvas, no node inicial, no fim de cada execution/trigger
  // node) lê workflowId + agentMode automaticamente do contexto.
  const agentMode = ((data?.workflow as { agentMode?: boolean })?.agentMode ??
    false) as boolean;

  // Issues estruturais do grafo (workflow.validate) — auto-refresh a cada 5s.
  // Cada `BaseExecutionNode`/`BaseTriggerNode` lê via `useNodeIssues(id)` pra
  // pintar borda vermelha e listar problemas no tooltip.
  const { data: validationData } = useWorkflowValidation(workflowId);
  const issuesContextValue = useMemo(
    () => ({
      issuesByNode: (validationData?.issuesByNode ?? {}) as Record<
        string,
        GraphIssue[]
      >,
      allIssues: (validationData?.graphIssues ?? []) as GraphIssue[],
      isLoading: false,
    }),
    [validationData],
  );

  return (
    <WorkflowAgentModeProvider workflowId={workflowId} agentMode={agentMode}>
     <WorkflowIssuesProvider value={issuesContextValue}>
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
            edgeTypes={edgeTypes}
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
            <Panel position="top-right" className="flex items-center gap-2">
              {agentMode && (
                <RateLimitBadge
                  workflowId={workflowId}
                  maxRunsPerHour={
                    Number(
                      (data?.workflow as { maxRunsPerHour?: number })
                        ?.maxRunsPerHour,
                    ) || 60
                  }
                />
              )}
              {agentMode && <AgentDetailButton workflowId={workflowId} />}
              <WorkflowIssuesPanel workflowId={workflowId} />
              {agentMode && <DryRunButton workflowId={workflowId} />}
              <StepByStepContainer workflowId={workflowId} />
              <AddNodeButton />
            </Panel>
            {hasManuelTrigger && (
              <Panel position="bottom-center">
                <ExecuteWorkflowButton workflowId={workflowId} />
              </Panel>
            )}
            <NodeSelector
              open={openSelector}
              onOpenChange={setOpenSelector}
            />
          </ReactFlow>
        </MenuOptions>
      </div>

      {/* <NodeSelector open={openSelector} onOpenChange={setOpenSelector} /> */}
     </WorkflowIssuesProvider>
    </WorkflowAgentModeProvider>
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
