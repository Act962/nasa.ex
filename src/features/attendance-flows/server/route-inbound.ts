import "server-only";
import prisma from "@/lib/prisma";
import { sendWorkflowExecution } from "@/inngest/utils";
import { parseAttendanceEntry, pickEntryFlow, type ActiveEntryOfFlow } from "../lib/entry-rules";
import { flowLog, flowLogError, previewText } from "../lib/flow-log";
import { attendanceFlowsOfTrackingWhere } from "./flow-scope";
import { isCampaignReceiptOutsideFlow } from "./campaign-passthrough";
import { addToInbox } from "./inbox";
import { claimAttendanceRun, endAttendanceRun, findAttendanceLock, RELEASED_LOCK_FIELDS } from "./lock";

// Quem responde a mensagem do cliente (spec 0139, RF-6 e D-2). Roda antes de a IA ser acionada.

export type AttendanceRouteResult =
  | { handled: false }
  | { handled: true; reason: "in_flow" | "started"; workflowId: string; runId: string };

const NOT_HANDLED: AttendanceRouteResult = { handled: false };

async function loadActiveEntries(trackingId: string): Promise<ActiveEntryOfFlow[]> {
  const startNodes = await prisma.node.findMany({
    where: { type: "ATTENDANCE_START", workflow: attendanceFlowsOfTrackingWhere(trackingId) },
    select: { workflowId: true, data: true, workflow: { select: { name: true } } },
  });
  return startNodes
    .map((node) => ({ workflowId: node.workflowId, workflowName: node.workflow.name, entry: parseAttendanceEntry(node.data) }))
    .filter((flow) => flow.entry.mode !== "BROADCAST");
}

/** Primeira mensagem do contato neste número: só a que acabou de chegar (CB-10). */
async function isFirstInboundOfConversation(conversationId: string): Promise<boolean> {
  const inbound = await prisma.message.findMany({
    where: { conversationId, fromMe: false },
    select: { id: true },
    take: 2,
  });
  return inbound.length <= 1;
}

/**
 * Mensagem de quem já está no fluxo vai para a caixa da execução: o motor a usa como resposta. No bloco Atraso ela não
 * responde nada, e entrar na caixa faria dela a resposta da próxima pergunta, antes de o cliente vê-la.
 */
async function deliverToRun(params: { messageInternalId: string; leadId: string }, lock: { id: string; waitingFor: string | null }): Promise<void> {
  if (lock.waitingFor === "TIME") {
    flowLog("inbound.ignored_during_delay", { lead: params.leadId, run: lock.id });
    return;
  }
  await addToInbox(params.messageInternalId, lock.id);
}

export async function routeInboundToAttendanceFlow(params: {
  trackingId: string;
  leadId: string;
  conversationId: string;
  messageText: string;
  /** Id interno da mensagem já gravada. */
  messageInternalId: string;
}): Promise<AttendanceRouteResult> {
  // 1. Já está dentro de um fluxo: a mensagem é dele (a espera acorda pelo evento da mensagem).
  const logFields = { lead: params.leadId, tracking: params.trackingId, text: previewText(params.messageText) };
  flowLog("inbound", logFields);
  const lock = await findAttendanceLock(params.leadId);
  if (lock) {
    const isStale = !lock.waitingUntil || lock.waitingUntil.getTime() < Date.now();
    if (!isStale) {
      flowLog("inbound.in_flow", { lead: params.leadId, run: lock.id, flow: lock.workflowId, waitFor: lock.waitingFor });
      await deliverToRun(params, lock);
      return { handled: true, reason: "in_flow", workflowId: lock.workflowId, runId: lock.id };
    }
    flowLog("inbound.stale_lock_expired", { lead: params.leadId, run: lock.id });
    await endAttendanceRun(lock.id, "expired");
  }

  // 2 a 4. Palavra-chave, boas-vindas, resposta padrão.
  const flows = await loadActiveEntries(params.trackingId);
  if (flows.length === 0) {
    flowLog("inbound.no_active_flow", logFields);
    return NOT_HANDLED;
  }
  // Cupom de inscrito segue para a campanha da IA do funil, como antes do FlowAstro (spec 0140, D-3).
  if (await isCampaignReceiptOutsideFlow(params)) {
    flowLog("inbound.campaign_receipt", logFields);
    return NOT_HANDLED;
  }
  const hasWelcome = flows.some((flow) => flow.entry.mode === "WELCOME");
  const isFirstInbound = hasWelcome ? await isFirstInboundOfConversation(params.conversationId) : false;
  const chosen = pickEntryFlow({ flows, messageText: params.messageText, isFirstInbound });
  if (!chosen) {
    flowLog("inbound.no_entry_match", { ...logFields, flows: flows.map((flow) => `${flow.workflowName}:${flow.entry.mode}`).join(","), firstInbound: isFirstInbound });
    return NOT_HANDLED;
  }

  const runId = await claimAttendanceRun({ workflowId: chosen.workflowId, leadId: params.leadId, entryMode: chosen.entry.mode });
  if (!runId) {
    // Outra mensagem do mesmo contato pegou a trava no mesmo instante (CB-1): o fluxo dela responde.
    const winner = await findAttendanceLock(params.leadId);
    flowLog("inbound.claim_lost", { lead: params.leadId, winnerRun: winner?.id });
    if (winner) await deliverToRun(params, winner);
    return winner ? { handled: true, reason: "in_flow", workflowId: winner.workflowId, runId: winner.id } : NOT_HANDLED;
  }

  try {
    await sendWorkflowExecution({
      workflowId: chosen.workflowId,
      triggerType: "ATTENDANCE_START",
      leadId: params.leadId,
      attendanceRunId: runId,
      initialData: { messageText: params.messageText, entryMode: chosen.entry.mode, trackingId: params.trackingId },
    });
  } catch (error) {
    // Sem a execução, ninguém responderia: solta a trava e deixa a mensagem seguir o caminho de antes.
    flowLogError("inbound.dispatch_failed", error, { lead: params.leadId, run: runId });
    await prisma.workflowRun.update({
      where: { id: runId },
      data: { ...RELEASED_LOCK_FIELDS, status: "FAILED", errorMessage: "Falha ao iniciar o fluxo", finishedAt: new Date() },
    });
    return NOT_HANDLED;
  }
  flowLog("flow.started", { lead: params.leadId, run: runId, flow: chosen.workflowName, entry: chosen.entry.mode });
  return { handled: true, reason: "started", workflowId: chosen.workflowId, runId };
}
