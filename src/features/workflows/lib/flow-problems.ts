import { isButtonsOfficialOnly } from "@/features/tracking-chat/lib/numbered-menu";
import { validateNode } from "./validate-node";
import { isMetaInteractiveOn } from "./button-reply-flow";
import {
  diagnoseFlow,
  indexFlowDiagnostics,
  type FlowChannelProvider,
  type FlowDiagnostic,
  type FlowDiagnosticsIndex,
  type FlowEdgeInput,
  type FlowNodeInput,
} from "./flow-diagnostics";

// Tudo que deixa um passo em vermelho, num lugar só: regras do canal, ligações quebradas e passo
// sem configurar. Usado pelo editor de um fluxo e pelo mapa da operação, para os dois pintarem igual.

export function collectFlowProblems(nodes: FlowNodeInput[], edges: FlowEdgeInput[], provider: FlowChannelProvider): FlowDiagnosticsIndex {
  // Passo sem configurar (ou marcado pela IA para revisão) não roda direito: entra na mesma conta,
  // para o vermelho seguir pelo contorno, pelas linhas e pelo que vem depois.
  const incompleteSteps: FlowDiagnostic[] = nodes.flatMap((node) => {
    const nodeData = node.data as Record<string, unknown> | undefined;
    const validation = node.type ? validateNode(node.type, nodeData) : undefined;
    const isInvalid = Boolean(validation && !validation.skip && !validation.valid);
    const needsReview = nodeData?.needsReview === true;
    if (!isInvalid && !needsReview) return [];
    return [
      {
        nodeId: node.id,
        edgeIds: edges.filter((edge) => edge.source === node.id || edge.target === node.id).map((edge) => edge.id),
        severity: "error" as const,
        code: "NODE_INCOMPLETE" as const,
        title: "Passo incompleto",
        message: validation?.errors.join(" ") || String(nodeData?.reviewReason ?? "Falta configurar este passo."),
        fixHint: "Abrir a configuração",
      },
    ];
  });
  return indexFlowDiagnostics(
    [...diagnoseFlow(nodes, edges, { provider, canSendOfficialMenu: isMetaInteractiveOn(), sendsMenuAsNumberedText: isButtonsOfficialOnly() }), ...incompleteSteps],
    edges,
  );
}
