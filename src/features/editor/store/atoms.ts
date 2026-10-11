import type { ReactFlowInstance } from "@xyflow/react";
import { atom } from "jotai";
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
