import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { hasAppPermission } from "@/features/permissions/server/app-permission";
import { HANDOFF_MODE, LINK_REFUSAL_MESSAGES, handoffTarget, refuseFlowLink } from "@/features/workflows/lib/flow-links";
import { canAccessWorkflow } from "@/features/workflows/server/workflow-access";
import prisma from "@/lib/prisma";
import { z } from "zod";

// Liga e desliga dois fluxos do mesmo funil pelo mapa da operação (spec 0092, etapa 2):
// "terminou um, roda o outro". Só acrescenta ou remove o passo de passagem no fim do fluxo de
// origem; os outros passos não são tocados.

const HANDOFF_NODE_GAP = 320;
const linkInput = z.object({ fromWorkflowId: z.string(), toWorkflowId: z.string() });

type Position = { x: number; y: number };

function readPosition(position: unknown): Position {
  const point = (position && typeof position === "object" ? position : {}) as { x?: unknown; y?: unknown };
  return { x: Number(point.x) || 0, y: Number(point.y) || 0 };
}

/** Os dois fluxos, só se forem do mesmo funil e a pessoa puder editar automações da empresa dele. */
async function loadLinkableFlows(fromWorkflowId: string, toWorkflowId: string, userId: string) {
  if (!(await canAccessWorkflow(fromWorkflowId, userId)) || !(await canAccessWorkflow(toWorkflowId, userId))) return null;
  const source = await prisma.workflow.findUnique({
    where: { id: fromWorkflowId },
    select: { trackingId: true, tracking: { select: { organizationId: true } } },
  });
  if (!source?.trackingId || !source.tracking) return null;
  if (!(await hasAppPermission(source.tracking.organizationId, userId, "tracking-automacoes", "canEdit"))) return null;
  const flows = await prisma.workflow.findMany({
    where: { trackingId: source.trackingId },
    select: {
      id: true,
      agentMode: true,
      nodes: { select: { id: true, type: true, data: true, position: true } },
      connections: { select: { fromNodeId: true } },
    },
  });
  // Fluxo de outro funil não aparece na lista: a regra o recusa como desconhecido.
  return { trackingId: source.trackingId, flows };
}

export const linkFlows = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", path: "/workflow/link-flows", summary: "Liga dois fluxos: terminou um, roda o outro" })
  .input(linkInput)
  .output(z.object({ nodeId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const loaded = await loadLinkableFlows(input.fromWorkflowId, input.toWorkflowId, context.user.id);
    if (!loaded) throw errors.NOT_FOUND({ message: "Fluxo não encontrado" });

    const refusal = refuseFlowLink({ flows: loaded.flows, fromWorkflowId: input.fromWorkflowId, toWorkflowId: input.toWorkflowId });
    if (refusal) throw errors.BAD_REQUEST({ message: LINK_REFUSAL_MESSAGES[refusal] });

    const source = loaded.flows.find((flow) => flow.id === input.fromWorkflowId)!;
    const steps = source.nodes.filter((node) => node.type !== "INITIAL");
    if (steps.length === 0) throw errors.BAD_REQUEST({ message: "O fluxo de origem ainda não tem passos." });
    // A passagem sai de todo fim de caminho do fluxo de origem.
    const nodesWithOutgoing = new Set(source.connections.map((connection) => connection.fromNodeId));
    const endSteps = steps.filter((node) => !nodesWithOutgoing.has(node.id));
    const positions = steps.map((node) => readPosition(node.position));
    const endPositions = endSteps.map((node) => readPosition(node.position));
    const handoffPosition = {
      x: Math.max(...positions.map((position) => position.x)) + HANDOFF_NODE_GAP,
      y: endPositions.reduce((total, position) => total + position.y, 0) / Math.max(1, endPositions.length),
    };

    const created = await prisma.$transaction(async (tx) => {
      const handoffNode = await tx.node.create({
        data: {
          workflowId: source.id,
          name: "CALL_WORKFLOW",
          type: "CALL_WORKFLOW",
          position: handoffPosition,
          data: { workflowId: input.toWorkflowId, mode: HANDOFF_MODE },
        },
        select: { id: true },
      });
      await tx.connection.createMany({
        data: endSteps.map((endStep) => ({
          workflowId: source.id,
          fromNodeId: endStep.id,
          toNodeId: handoffNode.id,
          fromOutput: "main",
          toInput: "main",
        })),
      });
      await tx.workflow.update({ where: { id: source.id }, data: { updatedAt: new Date() } });
      return handoffNode;
    });
    return { nodeId: created.id };
  });

export const unlinkFlows = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", path: "/workflow/unlink-flows", summary: "Desfaz a ligação entre dois fluxos" })
  .input(linkInput)
  .output(z.object({ removed: z.number() }))
  .handler(async ({ input, context, errors }) => {
    const loaded = await loadLinkableFlows(input.fromWorkflowId, input.toWorkflowId, context.user.id);
    if (!loaded) throw errors.NOT_FOUND({ message: "Fluxo não encontrado" });
    const source = loaded.flows.find((flow) => flow.id === input.fromWorkflowId);
    const handoffNodeIds = (source?.nodes ?? []).filter((node) => handoffTarget(node) === input.toWorkflowId).map((node) => node.id);
    if (handoffNodeIds.length === 0) return { removed: 0 };
    // As ligações que chegam no passo somem junto (cascata do banco).
    const removed = await prisma.node.deleteMany({ where: { id: { in: handoffNodeIds }, workflowId: input.fromWorkflowId } });
    return { removed: removed.count };
  });
