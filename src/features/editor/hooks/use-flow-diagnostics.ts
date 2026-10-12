import { useAtomValue } from "jotai";
import type { FlowDiagnostic } from "@/features/workflows/lib/flow-diagnostics";
import { flowDiagnosticsAtom } from "../store/atoms";

const NO_DIAGNOSTICS: FlowDiagnostic[] = [];

/** Erros e avisos previstos para um quadro do fluxo. */
export function useNodeFlowDiagnostics(nodeId: string): FlowDiagnostic[] {
  return useAtomValue(flowDiagnosticsAtom).byNode[nodeId] ?? NO_DIAGNOSTICS;
}

/** A ligação toca um quadro com erro previsto. */
export function useIsEdgeOnFlowError(edgeId: string): boolean {
  return useAtomValue(flowDiagnosticsAtom).errorEdgeIds[edgeId] === true;
}

/** O quadro vem depois de um passo com problema: se aquele falhar, este não roda. */
export function useIsNodeBlockedByFlowProblem(nodeId: string): boolean {
  return useAtomValue(flowDiagnosticsAtom).blockedNodeIds[nodeId] === true;
}

