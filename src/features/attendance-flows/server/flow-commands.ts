import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { NodeType } from "@/generated/prisma/enums";
import { PLACEHOLDER_PROBLEM, hasPlaceholderText } from "@/features/workflows/lib/placeholder-text";
import prisma from "@/lib/prisma";
import { buildFlowTemplate, type FlowTemplateKey } from "../lib/flow-templates";
import { findAttendanceEntryConflict } from "./entry-guard";
import { endAllRunsOfFlow } from "./lock";

// Ações do FlowAstro usadas pela tela e pelo MCP (spec 0142, D-3): as regras valem iguais pelos dois caminhos.

function isSavedMenuStep(nodeData: unknown): boolean {
  const payload = (nodeData as { action?: { payload?: { mode?: unknown } } } | null)?.action?.payload;
  return payload?.mode === "preset";
}

export class FlowCommandError extends Error {
  constructor(
    message: string,
    readonly kind: "not_found" | "bad_request" = "bad_request",
  ) {
    super(message);
  }
}

/** Nasce desligado e sem número: só entra em produção depois de montado e ligado (spec 0139, RF-2). */
export async function createAttendanceFlow(params: { organizationId: string; userId: string; name: string; template: FlowTemplateKey }) {
  const template = buildFlowTemplate(params.template);
  return prisma.$transaction(async (tx) => {
    const created = await tx.workflow.create({
      data: {
        name: params.name,
        organizationId: params.organizationId,
        userId: params.userId,
        kind: "ATTENDANCE",
        agentMode: true,
        isActive: false,
        nodes: {
          create: template.nodes.map((node) => ({
            id: node.id,
            type: node.type as NodeType,
            name: node.type,
            position: node.position,
            data: node.data as Prisma.InputJsonValue,
          })),
        },
      },
      select: { id: true, name: true, updatedAt: true },
    });
    if (template.edges.length > 0) {
      await tx.connection.createMany({
        data: template.edges.map((edge) => ({
          workflowId: created.id,
          fromNodeId: edge.source,
          toNodeId: edge.target,
          fromOutput: edge.sourceOutput,
          toInput: "main",
        })),
      });
    }
    return created;
  });
}

/** Números em que o fluxo responde. Fluxo ligado não pode passar a disputar a entrada de outro (spec 0139, RF-5). */
export async function setAttendanceFlowNumbers(params: { workflowId: string; organizationId: string; trackingIds: string[] }) {
  const trackingIds = [...new Set(params.trackingIds)];
  const ownTrackings = await prisma.tracking.count({ where: { id: { in: trackingIds }, organizationId: params.organizationId } });
  if (ownTrackings !== trackingIds.length) throw new FlowCommandError("Número não encontrado", "not_found");

  const flow = await prisma.workflow.findFirst({ where: { id: params.workflowId, kind: "ATTENDANCE" }, select: { isActive: true } });
  if (!flow) throw new FlowCommandError("Fluxo não encontrado", "not_found");
  if (flow.isActive) {
    const conflict = await findAttendanceEntryConflict({ workflowId: params.workflowId, trackingIds });
    if (conflict) throw new FlowCommandError(conflict);
  }
  await prisma.$transaction([
    prisma.workflowTrackingLink.deleteMany({ where: { workflowId: params.workflowId, trackingId: { notIn: trackingIds } } }),
    prisma.workflowTrackingLink.createMany({
      data: trackingIds.map((trackingId) => ({ workflowId: params.workflowId, trackingId })),
      skipDuplicates: true,
    }),
  ]);
  return { trackingIds };
}

/**
 * Liga ou desliga um fluxo do FlowAstro com as travas do botão da tela: disputa de entrada (spec 0139, RF-5) e texto de
 * exemplo (spec 0097). Desligar tira os leads que estavam dentro (CB-6).
 */
export async function setAttendanceFlowActive(params: { workflowId: string; isActive: boolean }) {
  const flow = await prisma.workflow.findFirst({
    where: { id: params.workflowId, kind: "ATTENDANCE" },
    select: { id: true, isActive: true, nodes: { select: { data: true } } },
  });
  if (!flow) throw new FlowCommandError("Fluxo não encontrado", "not_found");
  if (params.isActive) {
    const conflict = await findAttendanceEntryConflict({ workflowId: flow.id });
    if (conflict) throw new FlowCommandError(conflict);
    if (flow.nodes.some((node) => hasPlaceholderText(node.data))) throw new FlowCommandError(`${PLACEHOLDER_PROBLEM.title}: ${PLACEHOLDER_PROBLEM.message}`);
    // O FlowAstro monta os botões no próprio bloco; menu salvo do funil não é conferido nem ligado por aqui.
    if (flow.nodes.some((node) => isSavedMenuStep(node.data))) {
      throw new FlowCommandError("Um bloco de mensagem usa menu salvo do funil. No FlowAstro, monte os botões no próprio bloco.");
    }
  }
  await prisma.workflow.update({ where: { id: flow.id }, data: { isActive: params.isActive } });
  if (!params.isActive) await endAllRunsOfFlow(flow.id);
  return { isActive: params.isActive, changed: flow.isActive !== params.isActive };
}
