/**
 * Converte um `Agent.spec.goals[]` (Fase 1 do Auto Agent — texto livre →
 * spec JSON) num grafo de Workflow visual em Modo Agente IA.
 *
 * Cada goal vira uma sequência de nós:
 *   AI_DECISION (avalia completionCriteria)
 *     ├ "completed" → próximo goal (onSuccess) ou fim
 *     └ "in_progress" → AI_GENERATE_TEXT → SEND_MESSAGE → WAIT_FOR_EVENT → loop
 *
 * Útil pra migrar agentes existentes do modo "input livre" pro modo visual
 * sem perder a config. Quem chama: `useMigrateAgentToWorkflow` na UI.
 */
import { createId } from "@paralleldrive/cuid2";
import type { PrismaClient } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { NodeType } from "@/generated/prisma/enums";
import { agentSpecSchema } from "@/features/auto-agent/lib/agent-spec.schema";

interface ConvertParams {
  agentId: string;
  organizationId: string;
  trackingId: string | null;
  agentName: string;
  spec: unknown;
  systemInstructions: string;
}

/**
 * Converte spec → graph e persiste como novo Workflow com `agentMode=true`.
 * Devolve o `workflowId` criado.
 */
export async function convertSpecToWorkflow(
  prisma: PrismaClient,
  params: ConvertParams,
) {
  const spec = agentSpecSchema.parse(params.spec);
  const goals = spec.goals;
  if (goals.length === 0) {
    throw new Error("Spec sem goals — nada pra converter");
  }

  const nodes: Array<{
    id: string;
    type: NodeType;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }> = [];
  const edges: Array<{
    id: string;
    fromNodeId: string;
    toNodeId: string;
    fromOutput: string;
    toInput: string;
  }> = [];

  // Trigger inicial
  const triggerId = createId();
  nodes.push({
    id: triggerId,
    type: NodeType.NEW_LEAD,
    position: { x: 0, y: 0 },
    data: {},
  });

  // Mapa goalId → primeiro node do goal (pra resolver onSuccess/onFailure)
  const goalEntryNode = new Map<string, string>();
  // Mapa goalId → último node "completed" (pra ligar saídas pra próximo goal)
  const goalExitNode = new Map<string, string>();
  const goalFailNode = new Map<string, string>();

  let xOffset = 280;
  for (const goal of goals) {
    const yBase = 0;
    const decisionId = createId();
    const genTextId = createId();
    const sendId = createId();
    const waitId = createId();

    // 1. AI_DECISION avalia completionCriteria do goal
    nodes.push({
      id: decisionId,
      type: NodeType.AI_DECISION,
      position: { x: xOffset, y: yBase },
      data: {
        organizationId: params.organizationId,
        prompt: [
          `Goal atual: ${goal.name}`,
          `Critério de conclusão: ${goal.completionCriteria}`,
          "",
          (params.systemInstructions ?? "").slice(0, 1000),
          "",
          "Analise o contexto do lead. Retorne 'completed' se o critério foi atingido, 'in_progress' caso contrário, 'failed' se inviável.",
        ].join("\n"),
        branches: [
          { id: "completed", label: `Goal "${goal.name}" concluído` },
          { id: "in_progress", label: "Continuar tentando" },
          { id: "failed", label: "Goal inviável" },
        ],
      },
    });
    goalEntryNode.set(goal.id, decisionId);

    // 2. AI_GENERATE_TEXT (gera mensagem pro lead)
    nodes.push({
      id: genTextId,
      type: NodeType.AI_GENERATE_TEXT,
      position: { x: xOffset, y: yBase + 200 },
      data: {
        organizationId: params.organizationId,
        prompt:
          goal.initialMessage ??
          `Tentando completar o goal "${goal.name}". Gere uma mensagem natural pro lead {{lead.name}} avançar nesse goal.`,
        tone: "amigável e consultivo",
        maxTokens: 280,
      },
    });

    // 3. SEND_MESSAGE
    nodes.push({
      id: sendId,
      type: NodeType.SEND_MESSAGE,
      position: { x: xOffset, y: yBase + 350 },
      data: {
        action: {
          payload: { type: "TEXT", message: "{{vars.lastGeneratedText}}" },
        },
      },
    });

    // 4. WAIT_FOR_EVENT (resposta do lead)
    nodes.push({
      id: waitId,
      type: NodeType.WAIT_FOR_EVENT,
      position: { x: xOffset, y: yBase + 500 },
      data: {
        eventName: "message-incoming",
        timeoutMinutes: 60 * 24,
      },
    });
    goalExitNode.set(goal.id, decisionId); // "completed" branch
    goalFailNode.set(goal.id, decisionId); // "failed" branch

    // Conexões internas do goal
    edges.push({
      id: createId(),
      fromNodeId: decisionId,
      toNodeId: genTextId,
      fromOutput: "in_progress",
      toInput: "main",
    });
    edges.push({
      id: createId(),
      fromNodeId: genTextId,
      toNodeId: sendId,
      fromOutput: "main",
      toInput: "main",
    });
    edges.push({
      id: createId(),
      fromNodeId: sendId,
      toNodeId: waitId,
      fromOutput: "main",
      toInput: "main",
    });
    edges.push({
      id: createId(),
      fromNodeId: waitId,
      toNodeId: decisionId,
      fromOutput: "main",
      toInput: "main",
    });

    xOffset += 600;
  }

  // Trigger → primeiro goal
  edges.push({
    id: createId(),
    fromNodeId: triggerId,
    toNodeId: goalEntryNode.get(goals[0].id)!,
    fromOutput: "main",
    toInput: "main",
  });

  // onSuccess / onFailure
  for (const goal of goals) {
    const fromCompleted = goalExitNode.get(goal.id)!;
    if (goal.onSuccess && goalEntryNode.has(goal.onSuccess)) {
      edges.push({
        id: createId(),
        fromNodeId: fromCompleted,
        toNodeId: goalEntryNode.get(goal.onSuccess)!,
        fromOutput: "completed",
        toInput: "main",
      });
    }
    if (goal.onFailure && goalEntryNode.has(goal.onFailure)) {
      edges.push({
        id: createId(),
        fromNodeId: goalFailNode.get(goal.id)!,
        toNodeId: goalEntryNode.get(goal.onFailure)!,
        fromOutput: "failed",
        toInput: "main",
      });
    }
  }

  // Persiste tudo
  return prisma.$transaction(async (tx) => {
    const workflow = await tx.workflow.create({
      data: {
        id: createId(),
        name: `${params.agentName} (visual)`,
        description: `Gerado automaticamente a partir do Agent.spec do agente "${params.agentName}".`,
        trackingId: params.trackingId,
        agentMode: true,
        maxRunsPerHour: 60,
        isActive: false,
        agentId: params.agentId,
      },
    });

    for (const n of nodes) {
      await tx.node.create({
        data: {
          id: n.id,
          workflowId: workflow.id,
          name: n.type,
          type: n.type,
          position: n.position,
          data: n.data as Prisma.InputJsonValue,
        },
      });
    }
    for (const e of edges) {
      await tx.connection.create({
        data: {
          id: e.id,
          workflowId: workflow.id,
          fromNodeId: e.fromNodeId,
          toNodeId: e.toNodeId,
          fromOutput: e.fromOutput,
          toInput: e.toInput,
        },
      });
    }

    return {
      workflowId: workflow.id,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    };
  });
}
