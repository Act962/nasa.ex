import type { ReactFlowInstance } from "@xyflow/react";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { EMPTY_FLOW_DIAGNOSTICS, type FlowDiagnosticsIndex } from "@/features/workflows/lib/flow-diagnostics";

export const editorAtom = atom<ReactFlowInstance | null>(null);

/**
 * Snapshot JSON do último estado salvo (nodes+edges). Usado em conjunto
 * com o estado atual do editor pra detectar alterações pendentes —
 * quando `lastSaved !== currentSnapshot`, marca `workflowDirtyAtom`.
 *
 * Setado em duas situações:
 *  1. Mount do editor → snapshot inicial = dados que vieram do servidor
 *  2. Save bem-sucedido → snapshot = estado salvo
 */
export const lastSavedSnapshotAtom = atom<string>("");

/**
 * Flag derivada: true quando há alterações no canvas que ainda não
 * foram salvas. Lida por: breadcrumb (intercepta navegação) e listener
 * `beforeunload` (alerta nativo no refresh/close).
 */
export const workflowDirtyAtom = atom<boolean>(false);

/**
 * Erros e avisos previstos para o fluxo que está na tela (spec 0090, seção C).
 * Recalculado pelo editor a cada alteração do desenho, sem esperar o salvar.
 */
export const flowDiagnosticsAtom = atom<FlowDiagnosticsIndex>(EMPTY_FLOW_DIAGNOSTICS);

/** Ligação em que a pessoa pediu para encaixar um passo novo no meio (botão "+" da ligação). */
export const insertOnEdgeIdAtom = atom<string | null>(null);

/**
 * Enquanto uma ligação é arrastada: em qual quadro o ponteiro está e se dá para ligar ali.
 * O quadro mostra um "+" quando dá; a linha fica vermelha quando não dá.
 */
export const connectionHoverAtom = atom<{ nodeId: string; isAllowed: boolean } | null>(null);

/**
 * Fluxo aberto só para olhar: a pessoa não tem a permissão de editar Automações (spec 0092).
 * Os quadros não se movem, não abrem configuração e não mostram botões de mexer.
 */
export const editorReadOnlyAtom = atom(false);

export type EditorViewMode = "icon" | "rich";

/**
 * Como os quadros do fluxo são desenhados (spec 0090, seção B): "icon" é o desenho de sempre;
 * "rich" mostra o card do lead nos gatilhos e o celular nas mensagens. Escolha de cada pessoa,
 * guardada no navegador.
 */
export const editorViewModeAtom = atomWithStorage<EditorViewMode>("orbita:workflow-editor-view", "rich");
