import { savedMenuIdOf } from "./menu-option-outputs";
import { PLACEHOLDER_PROBLEM, hasPlaceholderText } from "./placeholder-text";
import { isButtonsOfficialOnly } from "@/features/tracking-chat/lib/numbered-menu";
import { validateNode } from "./validate-node";
import { BUTTON_OUTPUT_PREFIX, isMetaInteractiveOn } from "./button-reply-flow";
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

/** Menu salvo do atendimento, no que importa para o diagnóstico: o texto e as opções que o cliente recebe. */
export interface SavedMenuContent {
  id: string;
  bodyText?: unknown;
  buttons?: unknown;
}

export function collectFlowProblems(
  nodes: FlowNodeInput[],
  edges: FlowEdgeInput[],
  provider: FlowChannelProvider,
  savedMenus: SavedMenuContent[] = [],
): FlowDiagnosticsIndex {
  // Texto de exemplo do modelo de atendimento (spec 0097), no passo ou no menu salvo que ele envia.
  const placeholderSteps: FlowDiagnostic[] = nodes.flatMap((node) => {
    const nodeData = node.data as Record<string, unknown> | undefined;
    const savedMenuId = savedMenuIdOf(nodeData);
    const savedMenu = savedMenuId ? savedMenus.find((menu) => menu.id === savedMenuId) : undefined;
    if (!hasPlaceholderText(nodeData) && !hasPlaceholderText([savedMenu?.bodyText, savedMenu?.buttons])) return [];
    return [
      {
        nodeId: node.id,
        edgeIds: edges.filter((edge) => edge.source === node.id || edge.target === node.id).map((edge) => edge.id),
        severity: "error" as const,
        code: "PLACEHOLDER_TEXT" as const,
        title: PLACEHOLDER_PROBLEM.title,
        message: PLACEHOLDER_PROBLEM.message,
        fixHint: savedMenu ? "Abrir os menus do atendimento" : "Abrir a configuração",
      },
    ];
  });

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
  // Ligação saindo de uma opção que o menu salvo não tem mais (spec 0098, RF-9). Só com os menus em
  // mãos: sem eles não dá para afirmar que a opção sumiu.
  const missingOptionSteps: FlowDiagnostic[] = nodes.flatMap((node) => {
    const savedMenuId = savedMenuIdOf(node.data as Record<string, unknown> | undefined);
    const savedMenu = savedMenuId ? savedMenus.find((menu) => menu.id === savedMenuId) : undefined;
    if (!savedMenu) return [];
    const optionIds = new Set((Array.isArray(savedMenu.buttons) ? (savedMenu.buttons as { id?: unknown }[]) : []).map((button) => String(button.id ?? "")));
    const orphanEdges = edges.filter(
      (edge) => edge.source === node.id && edge.sourceHandle?.startsWith(BUTTON_OUTPUT_PREFIX) && !optionIds.has(edge.sourceHandle.slice(BUTTON_OUTPUT_PREFIX.length)),
    );
    if (orphanEdges.length === 0) return [];
    return [
      {
        nodeId: node.id,
        edgeIds: orphanEdges.map((edge) => edge.id),
        severity: "error" as const,
        code: "MENU_OPTION_MISSING" as const,
        title: "Esta opção não existe mais no menu",
        message: "Há um passo ligado a uma opção que saiu do menu salvo. Ele não roda mais.",
        fixHint: "Apague a ligação ou ligue em outra opção",
      },
    ];
  });
  return indexFlowDiagnostics(
    [...diagnoseFlow(nodes, edges, { provider, canSendOfficialMenu: isMetaInteractiveOn(), sendsMenuAsNumberedText: isButtonsOfficialOnly() }), ...incompleteSteps, ...placeholderSteps, ...missingOptionSteps],
    edges,
  );
}
