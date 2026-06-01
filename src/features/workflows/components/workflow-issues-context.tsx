"use client";

/**
 * Context que distribui o resultado de `workflow.validate` pra todos os
 * `BaseExecutionNode`/`BaseTriggerNode` do canvas. Cada nó consulta
 * `issuesByNode[node.id]` pra calcular se mostra borda vermelha.
 *
 * Por que context: alternativa seria passar via props pelo React Flow,
 * mas o XYFlow re-renderiza os nodes individualmente — contexto resolve
 * sem prop-drilling. Mantém o BaseExecutionNode sem mudar de assinatura.
 */
import { createContext, useContext, type ReactNode } from "react";
import type { GraphIssue } from "@/features/workflows/lib/validate-workflow-graph";

export type WorkflowIssuesContextValue = {
  /** Issues estruturais agrupadas por node id. */
  issuesByNode: Record<string, GraphIssue[]>;
  /** Todos os issues (incluindo `nodeId: null` — workflow-wide). */
  allIssues: GraphIssue[];
  /** Loading da query inicial. */
  isLoading: boolean;
};

const Ctx = createContext<WorkflowIssuesContextValue>({
  issuesByNode: {},
  allIssues: [],
  isLoading: false,
});

export function WorkflowIssuesProvider({
  value,
  children,
}: {
  value: WorkflowIssuesContextValue;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkflowIssues() {
  return useContext(Ctx);
}

/** Hook utilitário pra consultar issues de um nó específico. */
export function useNodeIssues(nodeId: string): GraphIssue[] {
  const { issuesByNode } = useContext(Ctx);
  return issuesByNode[nodeId] ?? [];
}
