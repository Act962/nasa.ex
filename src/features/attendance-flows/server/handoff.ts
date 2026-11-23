import "server-only";
import prisma from "@/lib/prisma";
import { sendWorkflowExecution } from "@/inngest/utils";
import { flowLog, flowLogError } from "../lib/flow-log";
import { ENGINE_VARIABLE } from "./executors";
import { moveInboxToRun } from "./inbox";
import { RELEASED_LOCK_FIELDS, RUNNING_LOCK_MS } from "./lock";

// "Conexão de fluxo" entre dois fluxos do FlowAstro (spec 0139, CB-8): a trava passa para uma execução nova do destino,
// que começa pela Entrada dele. Rodar o destino dentro da execução atual não funciona: ele não tem gatilho manual e as
// perguntas e botões dele não conseguem esperar.

export const ATTENDANCE_HANDOFF_ENTRY_MODE = "HANDOFF";

export type AttendanceHandoffResult =
  | { status: "handed_off"; runId: string }
  /** A execução atual já não tinha o lead (equipe assumiu, trava vencida): ninguém recebe a trava. */
  | { status: "lock_not_held" }
  | { status: "dispatch_failed"; runId: string };

/** Variáveis que o fluxo de origem coletou (Pergunta, Agente de IA...): o destino continua a conversa com elas. */
export function flowVariablesForHandoff(vars: Record<string, unknown>): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(vars).flatMap(([name, value]) =>
      !ENGINE_VARIABLE.test(name) && (typeof value === "string" || typeof value === "number" || typeof value === "boolean") ? [[name, value]] : [],
    ),
  );
}

type DispatchAttendanceRun = (payload: Parameters<typeof sendWorkflowExecution>[0]) => Promise<unknown>;

/**
 * Solta a trava da execução de origem e cria a do destino numa transação só: no meio do caminho, a mensagem do cliente
 * nunca encontra o lead fora de fluxo (senão abriria a Boas-vindas ou a IA do funil).
 */
async function transferAttendanceLock(params: { leadId: string; fromWorkflowId: string; toWorkflowId: string }): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const sourceRun = await tx.workflowRun.findFirst({
      where: { attendanceLeadId: params.leadId, workflowId: params.fromWorkflowId, status: "RUNNING" },
      select: { id: true },
    });
    if (!sourceRun) return null;
    const released = await tx.workflowRun.updateMany({
      where: { id: sourceRun.id, attendanceLeadId: params.leadId },
      data: RELEASED_LOCK_FIELDS,
    });
    if (released.count === 0) return null;
    const run = await tx.workflowRun.create({
      data: {
        workflowId: params.toWorkflowId,
        leadId: params.leadId,
        triggerType: "ATTENDANCE_START",
        status: "RUNNING",
        initialContext: { entryMode: ATTENDANCE_HANDOFF_ENTRY_MODE, fromWorkflowId: params.fromWorkflowId },
        attendanceLeadId: params.leadId,
        waitingUntil: new Date(Date.now() + RUNNING_LOCK_MS),
      },
      select: { id: true },
    });
    await moveInboxToRun(tx, { leadId: params.leadId, fromRunId: sourceRun.id, toRunId: run.id });
    return run.id;
  });
}

export async function handOffAttendanceFlow(
  params: {
    leadId: string;
    fromWorkflowId: string;
    toWorkflowId: string;
    /** Vai como `trigger` da execução nova (mesmo papel do `initialData` do roteador de entrada). */
    initialData: Record<string, unknown>;
    /** Variáveis do fluxo de origem (`context.vars`); as internas do motor ficam de fora. */
    flowVariables?: Record<string, unknown>;
  },
  dispatch: DispatchAttendanceRun = sendWorkflowExecution,
): Promise<AttendanceHandoffResult> {
  const runId = await transferAttendanceLock(params);
  if (!runId) {
    flowLog("flow.handoff_lock_not_held", { lead: params.leadId, flow: params.fromWorkflowId, to: params.toWorkflowId });
    return { status: "lock_not_held" };
  }
  try {
    await dispatch({
      workflowId: params.toWorkflowId,
      triggerType: "ATTENDANCE_START",
      leadId: params.leadId,
      attendanceRunId: runId,
      initialData: { ...params.initialData, entryMode: ATTENDANCE_HANDOFF_ENTRY_MODE },
      initialVars: flowVariablesForHandoff(params.flowVariables ?? {}),
    });
  } catch (error) {
    // Sem a execução, ninguém responderia: solta a trava para a próxima mensagem seguir o caminho de entrada.
    flowLogError("flow.handoff_dispatch_failed", error, { lead: params.leadId, run: runId });
    await prisma.workflowRun.update({
      where: { id: runId },
      data: { ...RELEASED_LOCK_FIELDS, status: "FAILED", errorMessage: "Falha ao iniciar o fluxo conectado", finishedAt: new Date() },
    });
    return { status: "dispatch_failed", runId };
  }
  flowLog("flow.handed_off", { lead: params.leadId, flow: params.fromWorkflowId, to: params.toWorkflowId, run: runId });
  return { status: "handed_off", runId };
}
