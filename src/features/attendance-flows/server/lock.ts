import "server-only";
import { flowLog, flowLogError } from "../lib/flow-log";
import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";

// "Lead dentro do fluxo" (spec 0139, D-3): a trava é a própria execução, com `attendanceLeadId` único.

/** Folga sobre o prazo da espera antes de considerar a trava esquecida (CB-4). */
const STALE_MARGIN_MS = 10 * 60_000;
/** Quanto a trava vale enquanto a execução está rodando um trecho sem espera. */
export const RUNNING_LOCK_MS = 15 * 60_000;

export const ATTENDANCE_CANCEL_EVENT = "workflow/attendance.cancel";

export type AttendanceEndReason = "team_took_over" | "removed_by_user" | "expired" | "flow_removed" | "node_removed" | "run_failed";

const END_REASON_LABELS: Record<AttendanceEndReason, string> = {
  team_took_over: "Equipe assumiu a conversa",
  removed_by_user: "Tirado do fluxo pela equipe",
  expired: "Trava vencida (execução não respondeu)",
  flow_removed: "Fluxo desativado ou removido",
  node_removed: "Bloco removido do fluxo",
  run_failed: "A execução do fluxo falhou",
};

export const RELEASED_LOCK_FIELDS = { attendanceLeadId: null, currentNodeId: null, waitingUntil: null, waitingFor: null } as const;

export function waitingUntilFor(timeoutMinutes: number, now = new Date()): Date {
  return new Date(now.getTime() + timeoutMinutes * 60_000 + STALE_MARGIN_MS);
}

export async function findAttendanceLock(leadId: string) {
  return prisma.workflowRun.findUnique({
    where: { attendanceLeadId: leadId },
    select: { id: true, workflowId: true, status: true, currentNodeId: true, waitingUntil: true, waitingFor: true },
  });
}

/** Cria a execução já com a trava. `null` = outro fluxo pegou o lead antes (CB-1). */
export async function claimAttendanceRun(params: {
  workflowId: string;
  leadId: string;
  entryMode: string;
}): Promise<string | null> {
  try {
    const run = await prisma.workflowRun.create({
      data: {
        workflowId: params.workflowId,
        leadId: params.leadId,
        triggerType: "ATTENDANCE_START",
        status: "RUNNING",
        initialContext: { entryMode: params.entryMode },
        attendanceLeadId: params.leadId,
        waitingUntil: new Date(Date.now() + RUNNING_LOCK_MS),
      },
      select: { id: true },
    });
    return run.id;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : undefined;
    if (code === "P2002") return null;
    throw error;
  }
}

/**
 * Encerra a execução do lead e solta a trava. A espera no Inngest é cancelada por evento, sem acordar a execução.
 * Devolve se havia fluxo para encerrar.
 */
export async function endAttendanceFlowForLead(leadId: string, reason: AttendanceEndReason): Promise<boolean> {
  const lock = await findAttendanceLock(leadId);
  if (!lock) return false;
  await endAttendanceRun(lock.id, reason);
  return true;
}

export async function endAttendanceRun(runId: string, reason: AttendanceEndReason): Promise<void> {
  const { count } = await prisma.workflowRun.updateMany({
    where: { id: runId, attendanceLeadId: { not: null } },
    data: { ...RELEASED_LOCK_FIELDS, status: "CANCELED", errorMessage: END_REASON_LABELS[reason], finishedAt: new Date() },
  });
  if (count === 0) return;
  flowLog("flow.ended", { run: runId, reason });
  await inngest
    .send({ name: ATTENDANCE_CANCEL_EVENT, data: { attendanceRunId: runId, reason } })
    .catch((error: unknown) => flowLogError("flow.cancel_event_failed", error, { run: runId }));
}

/** Avisos de cancelamento por envio ao Inngest. */
const CANCEL_EVENTS_PER_SEND = 500;

/**
 * Encerra várias execuções de uma vez: uma escrita no banco e os avisos ao Inngest em lote. Usado ao desligar ou
 * apagar o fluxo (CB-6) e ao apagar o bloco em que leads esperavam. Devolve quantas foram encerradas.
 */
export async function endAttendanceRuns(where: { workflowId: string; currentNodeIds?: string[] }, reason: AttendanceEndReason): Promise<number> {
  const scope = {
    workflowId: where.workflowId,
    attendanceLeadId: { not: null },
    ...(where.currentNodeIds ? { currentNodeId: { in: where.currentNodeIds } } : {}),
  };
  const runs = await prisma.workflowRun.findMany({ where: scope, select: { id: true } });
  if (runs.length === 0) return 0;
  const runIds = runs.map((run) => run.id);
  await prisma.workflowRun.updateMany({
    where: { id: { in: runIds }, attendanceLeadId: { not: null } },
    data: { ...RELEASED_LOCK_FIELDS, status: "CANCELED", errorMessage: END_REASON_LABELS[reason], finishedAt: new Date() },
  });
  flowLog("flow.ended_many", { flow: where.workflowId, runs: runIds.length, reason });
  for (let index = 0; index < runIds.length; index += CANCEL_EVENTS_PER_SEND) {
    const events = runIds.slice(index, index + CANCEL_EVENTS_PER_SEND).map((runId) => ({ name: ATTENDANCE_CANCEL_EVENT, data: { attendanceRunId: runId, reason } }));
    await inngest.send(events).catch((error: unknown) => flowLogError("flow.cancel_event_failed", error, { flow: where.workflowId }));
  }
  return runIds.length;
}

/** Encerra todas as execuções de um fluxo (desativado ou apagado: CB-6). */
export async function endAllRunsOfFlow(workflowId: string): Promise<number> {
  return endAttendanceRuns({ workflowId }, "flow_removed");
}
