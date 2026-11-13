import "server-only";
import { findAttendanceEntryConflict } from "@/features/attendance-flows/server/entry-guard";
import { endAttendanceRuns } from "@/features/attendance-flows/server/lock";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { sanitizeAiCapabilities } from "@/features/tracking-chat-ai/server/capability-access";
import { DISABLED_AI_CAPABILITIES, mergeBlockCapabilities, parseBlockCapabilities, pickBlockCapabilities } from "@/features/tracking-chat-ai/lib/capabilities";
import type { NodeType } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";

// Grava o desenho de um fluxo (blocos e ligações). Chamado pelo editor (`workflow.update.updateNodes`) e pelo MCP do
// FlowAstro (spec 0142, D-3): as travas valem iguais pelos dois caminhos.

export class WorkflowSaveError extends Error {}

export interface GraphNodeInput {
  id: string;
  type?: string | null;
  position: { x: number; y: number };
  data?: Record<string, unknown>;
}

export interface GraphEdgeInput {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface SaveActor {
  userId: string;
  userName: string;
  userEmail: string;
  userImage?: string | null;
}

export interface EntryConflict {
  message: string;
  startNodeId: string;
  startNodeData: Record<string, unknown>;
}

/** Menu de botões que espera o clique: segura o ciclo, porque o fluxo para até o cliente responder. */
function isMenuWaitingForClick(nodeData: unknown): boolean {
  const action = (nodeData as { action?: { payload?: { type?: unknown; waitForReply?: unknown } } } | null)?.action;
  return action?.payload?.type === "BUTTONS" && action.payload.waitForReply === true;
}

export async function saveWorkflowGraph(params: {
  workflowId: string;
  nodes: GraphNodeInput[];
  edges: GraphEdgeInput[];
  actor: SaveActor;
  /** `updatedAt` lido antes de editar (spec 0142, D-4). Mudou desde então: recusa em vez de sobrescrever. */
  expectedVersion?: string;
}) {
  const { workflowId: id, nodes, edges, actor } = params;
  const expectedUpdatedAt = params.expectedVersion !== undefined ? new Date(params.expectedVersion) : null;
  if (expectedUpdatedAt && Number.isNaN(expectedUpdatedAt.getTime())) {
    throw new WorkflowSaveError("Versão inválida. Leia o fluxo de novo e use a version que veio na leitura.");
  }
  const workflow = await prisma.workflow.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      name: true,
      trackingId: true,
      workspaceId: true,
      userId: true,
      folderId: true,
      isActive: true,
      agentMode: true,
      kind: true,
      organizationId: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      tracking: { select: { name: true, organizationId: true } },
    },
  });

  // Modo Agente IA: roda cycle-detector ANTES de persistir.
  // Workflows clássicos não têm branches/loops, então o detector é skip.
  if (workflow.agentMode) {
    const { detectCycles } = await import("@/features/workflows/lib/cycle-detector");
    // Menu que espera o clique também segura o ciclo: "voltar ao menu" não é loop infinito (spec 0139).
    const report = detectCycles(
      nodes.map((node) => ({ id: node.id, type: node.type === "SEND_MESSAGE" && isMenuWaitingForClick(node.data) ? "WAIT_FOR_EVENT" : node.type || "" })),
      edges.map((edge) => ({ fromNodeId: edge.source, toNodeId: edge.target })),
    );
    if (!report.safe) throw new WorkflowSaveError(`Loop infinito detectado:\n${report.warnings.join("\n")}`);
  }

  const isAttendanceFlow = workflow.kind === "ATTENDANCE";
  const previousNodes = isAttendanceFlow ? await prisma.node.findMany({ where: { workflowId: id }, select: { id: true, data: true } }) : [];
  const previousNodeById = new Map(previousNodes.map((node) => [node.id, node]));

  // Fluxo de atendimento ativo: o bloco Início não pode disputar a entrada com outro fluxo (spec 0139, RF-5). O resto
  // do desenho é salvo assim mesmo; o Início volta ao que era e quem salvou é avisado.
  let entryConflict: EntryConflict | null = null;
  let nodesToSave = nodes;
  if (isAttendanceFlow && workflow.isActive) {
    const startNode = nodes.find((node) => node.type === "ATTENDANCE_START");
    const conflict = await findAttendanceEntryConflict({
      workflowId: id,
      startNodeData: startNode ? (startNode.data ?? {}) : undefined,
    });
    const previousStart = startNode ? previousNodeById.get(startNode.id) : undefined;
    if (conflict && (!startNode || !previousStart)) throw new WorkflowSaveError(conflict);
    if (conflict && startNode && previousStart) {
      const previousData = (previousStart.data ?? {}) as Record<string, unknown>;
      entryConflict = { message: conflict, startNodeId: startNode.id, startNodeData: previousData };
      nodesToSave = nodes.map((node) => (node.id === startNode.id ? { ...node, data: previousData } : node));
    }
  }

  // Assistente próprio do bloco Agente de IA (spec 0139, D-14): mesma conferência da aba do funil antes de gravar.
  // Só confere de novo o que mudou: salvar outro bloco não troca em nome de quem a IA age (`configuredByUserId`).
  const organizationIdOfFlow = workflow.organizationId ?? workflow.tracking?.organizationId ?? null;
  const capabilitiesKey = (value: unknown) => {
    const { configuredByUserId: _configuredBy, ...rest } = pickBlockCapabilities(mergeBlockCapabilities(DISABLED_AI_CAPABILITIES, parseBlockCapabilities(value)));
    return JSON.stringify(rest);
  };
  const savedNodes =
    isAttendanceFlow && organizationIdOfFlow
      ? await Promise.all(
          nodesToSave.map(async (node) => {
            const assistant = node.type === "AI_AGENT" ? (node.data?.assistant as Record<string, unknown> | undefined) : undefined;
            if (!assistant || typeof assistant !== "object") return node;
            const previousAssistant = (previousNodeById.get(node.id)?.data as { assistant?: { capabilities?: unknown } } | null)?.assistant;
            if (previousAssistant?.capabilities && capabilitiesKey(previousAssistant.capabilities) === capabilitiesKey(assistant.capabilities)) {
              return { ...node, data: { ...node.data, assistant: { ...assistant, capabilities: previousAssistant.capabilities } } };
            }
            const capabilities = pickBlockCapabilities(
              await sanitizeAiCapabilities(mergeBlockCapabilities(DISABLED_AI_CAPABILITIES, parseBlockCapabilities(assistant.capabilities)), {
                organizationId: organizationIdOfFlow,
                userId: actor.userId,
              }),
            );
            return { ...node, data: { ...node.data, assistant: { ...assistant, capabilities } } };
          }),
        )
      : nodesToSave;
  const savedNodeIds = new Set(savedNodes.map((node) => node.id));
  const removedNodeIds = previousNodes.filter((node) => !savedNodeIds.has(node.id)).map((node) => node.id);
  const savedAt = new Date();

  await prisma.$transaction(async (tx) => {
    // A versão é conferida e trocada na mesma escrita: duas gravações com a mesma versão não passam as duas.
    const { count } = await tx.workflow.updateMany({
      where: { id, ...(expectedUpdatedAt ? { updatedAt: expectedUpdatedAt } : {}) },
      data: { updatedAt: savedAt },
    });
    if (count === 0) throw new WorkflowSaveError("O fluxo mudou desde a leitura. Leia de novo antes de salvar.");

    await tx.node.deleteMany({ where: { workflowId: id } });
    await tx.node.createMany({
      data: savedNodes.map((node) => ({
        id: node.id,
        workflowId: id,
        name: node.type || "unknown",
        type: node.type as NodeType,
        position: node.position,
        data: (node.data || {}) as object,
      })),
    });
    await tx.connection.createMany({
      data: edges.map((edge) => ({
        workflowId: id,
        fromNodeId: edge.source,
        toNodeId: edge.target,
        // Normaliza handles visuais default → semântica "main" no DB. Handles nomeados (true/false/loop/done/case_X,
        // branches IA) são preservados pra que o engine `run-workflow.ts` resolva `adjBy.get(nodeId).get(fromOutput)`.
        fromOutput: !edge.sourceHandle || edge.sourceHandle === "source-1" ? "main" : edge.sourceHandle,
        toInput: !edge.targetHandle || edge.targetHandle === "target-1" ? "main" : edge.targetHandle,
      })),
    });
  });

  // Lead esperando num bloco apagado sai do fluxo; a próxima mensagem dele entra pela regra de entrada (spec 0139).
  if (removedNodeIds.length > 0) {
    await endAttendanceRuns({ workflowId: id, currentNodeIds: removedNodeIds }, "node_removed").catch((error: unknown) =>
      console.error("[saveWorkflowGraph] fim das execuções do bloco apagado falhou", error),
    );
  }
  // Estrutura de nodes mudou — invalida o cache do gatilho FIRST_INTERACTION_OF_DAY (pode ter adicionado/removido o nó).
  if (workflow.trackingId) {
    const { invalidateReturningTriggerCache } = await import("@/features/triggers/components/first-interaction-of-day/dispatch");
    invalidateReturningTriggerCache(workflow.trackingId);
  }
  // Log fora da transaction — best-effort, não trava save.
  if (workflow.tracking?.organizationId) {
    await logActivity({
      organizationId: workflow.tracking.organizationId,
      userId: actor.userId,
      userName: actor.userName,
      userEmail: actor.userEmail,
      userImage: actor.userImage ?? undefined,
      appSlug: "tracking",
      action: "workflow.updated",
      actionLabel: `Editou a estrutura da automação "${workflow.name}"`,
      resource: workflow.name,
      resourceId: workflow.id,
      metadata: {
        trackingName: workflow.tracking.name,
        agentMode: workflow.agentMode,
        nodesCount: nodes.length,
        edgesCount: edges.length,
      },
    }).catch((error: unknown) => console.warn("[saveWorkflowGraph] logActivity failed", error));
  }
  return { workflow: { ...workflow, updatedAt: savedAt }, entryConflict, version: savedAt.toISOString() };
}
