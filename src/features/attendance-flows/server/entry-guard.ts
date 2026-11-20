import "server-only";
import prisma from "@/lib/prisma";
import { findEntryConflict, parseAttendanceEntry, type ActiveEntryOfFlow } from "../lib/entry-rules";
import { attendanceFlowsOfTrackingWhere, trackingIdsOfFlow } from "./flow-scope";

/**
 * Confere se o fluxo pode ficar ativo sem disputar a entrada com outro fluxo em nenhum dos números dele
 * (spec 0139, RF-5). `startNodeData` confere o desenho que está sendo salvo; `trackingIds` confere os números que
 * estão sendo escolhidos. Devolve a frase do conflito ou `null`.
 */
export async function findAttendanceEntryConflict(params: {
  workflowId: string;
  startNodeData?: unknown;
  trackingIds?: string[];
}): Promise<string | null> {
  const flow = await prisma.workflow.findUnique({
    where: { id: params.workflowId },
    select: {
      name: true,
      trackingId: true,
      trackingLinks: { select: { trackingId: true } },
      nodes: { where: { type: "ATTENDANCE_START" }, select: { data: true }, take: 1 },
    },
  });
  if (!flow) return "Fluxo não encontrado.";
  const startData = params.startNodeData !== undefined ? params.startNodeData : flow.nodes[0]?.data;
  if (startData === undefined) return "O fluxo precisa de um bloco Início.";
  const trackingIds = params.trackingIds ?? trackingIdsOfFlow(flow);
  if (trackingIds.length === 0) return "Escolha pelo menos um número para o fluxo responder.";

  const candidate: ActiveEntryOfFlow = { workflowId: params.workflowId, workflowName: flow.name, entry: parseAttendanceEntry(startData) };
  for (const trackingId of trackingIds) {
    const otherStarts = await prisma.node.findMany({
      where: { type: "ATTENDANCE_START", workflowId: { not: params.workflowId }, workflow: attendanceFlowsOfTrackingWhere(trackingId) },
      select: { workflowId: true, data: true, workflow: { select: { name: true } } },
    });
    const others = otherStarts.map((node) => ({ workflowId: node.workflowId, workflowName: node.workflow.name, entry: parseAttendanceEntry(node.data) }));
    const conflict = findEntryConflict(candidate, others);
    if (conflict) return conflict;
  }
  return null;
}
