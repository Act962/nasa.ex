"use client";

/**
 * Contexto pro Modo Agente IA. Provê `workflowId` + `agentMode` pra qualquer
 * `<NodeSelector>` renderizado dentro do editor — independente da profundidade
 * (botão "+" do canvas, botão "+" no fim de cada node, node inicial, etc.).
 *
 * Sem isso, cada um dos 5 lugares que renderiza o Sheet precisaria receber
 * props explicitamente, e o toggle "Modo Agente IA" só aparecia em 1 deles.
 */
import { createContext, useContext, type ReactNode } from "react";

export type WorkflowAgentModeContextValue = {
  workflowId: string;
  agentMode: boolean;
};

const WorkflowAgentModeContext =
  createContext<WorkflowAgentModeContextValue | null>(null);

export function WorkflowAgentModeProvider({
  workflowId,
  agentMode,
  children,
}: WorkflowAgentModeContextValue & { children: ReactNode }) {
  return (
    <WorkflowAgentModeContext.Provider value={{ workflowId, agentMode }}>
      {children}
    </WorkflowAgentModeContext.Provider>
  );
}

/**
 * Retorna `null` se não estiver dentro de um Provider (ex: editores antigos
 * que ainda não foram envolvidos). NodeSelector usa isso pra esconder o
 * toggle sem quebrar nada.
 */
export function useWorkflowAgentMode(): WorkflowAgentModeContextValue | null {
  return useContext(WorkflowAgentModeContext);
}
