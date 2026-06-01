import { atom } from "jotai";

/**
 * Estado do "Modo Step-by-Step" — testador visual interativo de workflows.
 * Diferente do Rocket-run (que executa tudo em dry-run), o Step-by-Step
 * deixa o user clicar em cada nó, escolher decisões manualmente
 * (branches, mocks de lead) e visualizar o path verde/vermelho conforme
 * avança.
 *
 * Estado vive em atoms client-side (não persiste em DB) — cada sessão
 * de teste é independente. Quando user clica "Resetar" ou sai do modo,
 * tudo é limpo.
 */

export type StepNodeStatus = "idle" | "current" | "passed" | "failed" | "warning";
export type StepEdgeStatus = "idle" | "passed" | "failed" | "skipped";

export interface MockLeadContext {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  statusId?: string;
  trackingId?: string;
  responsibleId?: string;
  isActive?: boolean;
}

export interface StepByStepState {
  /** True quando o usuário entrou no modo step-by-step. */
  active: boolean;
  /** Nó atualmente "selecionado" pra avançar (mostra foguete). */
  currentNodeId: string | null;
  /**
   * Status visual por nó. "current" tem prioridade. Nós não visitados
   * ficam idle.
   */
  nodeStatuses: Record<string, StepNodeStatus>;
  /** Status visual por edge (id da conexão). */
  edgeStatuses: Record<string, StepEdgeStatus>;
  /** Mensagens de erro por nó — exibidas no popover. */
  nodeErrors: Record<string, string[]>;
  /** Mensagens de warning por nó. */
  nodeWarnings: Record<string, string[]>;
  /** Histórico de nós visitados na ordem — pra rollback. */
  visitOrder: string[];
  /** Branch escolhido por AI_DECISION/IF/SWITCH — só pra esse nó. */
  branchChoices: Record<string, string>;
  /** Mock de contexto do lead injetado no teste. */
  mockLead: MockLeadContext;
  /** Trigger inicial escolhido (id do nó). */
  startTriggerNodeId: string | null;
}

const INITIAL_STATE: StepByStepState = {
  active: false,
  currentNodeId: null,
  nodeStatuses: {},
  edgeStatuses: {},
  nodeErrors: {},
  nodeWarnings: {},
  visitOrder: [],
  branchChoices: {},
  mockLead: {
    name: "Lead de Teste",
    email: "teste@nasa.local",
    phone: "5511999999999",
    isActive: true,
  },
  startTriggerNodeId: null,
};

export const stepByStepStateAtom = atom<StepByStepState>(INITIAL_STATE);

/** Atalho derivado: true quando o modo está ativo. */
export const isStepByStepActiveAtom = atom(
  (get) => get(stepByStepStateAtom).active,
);

/** Reset action — usado pra sair do modo ou recomeçar. */
export const resetStepByStepAtom = atom(null, (_get, set) => {
  set(stepByStepStateAtom, INITIAL_STATE);
});
