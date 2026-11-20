import "server-only";
import prisma from "@/lib/prisma";
import { sendLinkToLead } from "@/features/tracking-executions/lib/send-link-to-lead";
import { markAwaitingReply } from "@/features/workflows/lib/agent-executors/conversation-steps";
import { createMessageFiller } from "@/features/workflows/lib/agent-executors/message-variables";
import { flowOriginOf } from "@/features/workflows/lib/flow-origin";
import { consultantLoadWhere, assignedStatusFlowPatch } from "@/features/org-defaults/lib/attendance/rodizio";
import type { NodeExecutionResult, NodeExecutor } from "@/features/workflows/lib/run-workflow";
import type { WorkflowContext } from "@/features/workflows/lib/workflow-context";
import {
  AI_AGENT_OUTPUTS,
  ASK_QUESTION_OUTPUTS,
  DISTRIBUTE_OUTPUTS,
  RANDOMIZER_OUTPUT_PREFIX,
  parseAiAgent,
  parseAskQuestion,
  parseColumnMove,
  parseRandomizerPaths,
  pickRandomizerPath,
  isPhotoOrPdf,
  validateAnswer,
  type LeadFieldKey,
} from "../lib/nodes";

// Executores dos blocos novos do Fluxo de Atendimento (spec 0139, D-5). Pergunta e Agente de IA seguem o padrão dos
// passos de conversa (spec 0099): enviam, suspendem e voltam ao MESMO bloco quando o cliente responde.

export interface LeadRef {
  leadId: string;
  trackingId: string;
}

export function leadRefOf(context: WorkflowContext): LeadRef | null {
  const lead = (context.lead ?? {}) as { id?: unknown; trackingId?: unknown };
  const leadId = typeof lead.id === "string" ? lead.id : "";
  const trackingId = typeof lead.trackingId === "string" ? lead.trackingId : "";
  return leadId && trackingId ? { leadId, trackingId } : null;
}

/** Sem prazo e o teto técnico venceu: o fluxo do lead termina em silêncio (spec 0139, D-13). */
export const EXPIRED_RESULT: NodeExecutionResult = { output: { isWaitingReply: false, endFlow: true, finishedBy: "expired" } };

export const MISSING_LEAD: NodeExecutionResult = { output: { error: "lead_missing" }, status: "FAILED", errorMessage: "Fluxo sem lead no contexto" };

export interface ClientReply {
  hasTimedOut: boolean;
  text: string;
  /** Id da mensagem no WhatsApp (`Message.messageId`). */
  messageId: string;
  /** Id do botão ou item de lista tocado. */
  clickedId: string;
}

export function readClientReply(context: WorkflowContext): ClientReply {
  const vars = (context.vars ?? {}) as {
    lastWaitTimedOut?: unknown;
    lastEvent?: { messageText?: unknown; messageId?: unknown; interactiveReplyId?: unknown };
  };
  const event = vars.lastEvent;
  return {
    hasTimedOut: vars.lastWaitTimedOut === true,
    text: typeof event?.messageText === "string" ? event.messageText : "",
    messageId: typeof event?.messageId === "string" ? event.messageId : "",
    clickedId: typeof event?.interactiveReplyId === "string" ? event.interactiveReplyId : "",
  };
}

/** Foto ou PDF que o cliente mandou nesta resposta, conferindo que a mensagem é da conversa do próprio lead. */
async function photoAnswerOf(reply: ClientReply, leadId: string): Promise<string | null> {
  if (!reply.messageId) return null;
  const message = await prisma.message.findUnique({
    where: { messageId: reply.messageId },
    select: { fromMe: true, mimetype: true, mediaUrl: true, conversation: { select: { leadId: true } } },
  });
  if (!message || message.fromMe || message.conversation.leadId !== leadId) return null;
  // Foto que não baixou não serve como resposta: o bloco pede de novo (spec 0140, D-6).
  return message.mediaUrl && isPhotoOrPdf(message.mimetype) ? reply.messageId : null;
}

/** O que o bloco guardou na vez anterior, se estava esperando o cliente. */
export function waitingStateOf<TState>(nodeId: string, context: WorkflowContext): TState | null {
  const previous = (context.nodeOutputs?.[nodeId] ?? null) as { isWaitingReply?: unknown; state?: unknown } | null;
  return previous?.isWaitingReply === true ? ((previous.state ?? {}) as TState) : null;
}

/** Variáveis que o próprio fluxo criou (Pergunta, Agente de IA, Distribuir); as internas do motor ficam de fora. */
const ENGINE_VARIABLE = /^(last[A-Z]|__)|^generatedTextHistory$/;

function flowVariablesOf(context: WorkflowContext): Record<string, string> {
  return Object.fromEntries(
    Object.entries(context.vars ?? {}).flatMap(([name, value]) =>
      !ENGINE_VARIABLE.test(name) && (typeof value === "string" || typeof value === "number" || typeof value === "boolean") && String(value).trim()
        ? [[name, String(value)]]
        : [],
    ),
  );
}

export function waitForReply<TState>(state: TState, timeoutMinutes: number): NodeExecutionResult {
  return {
    status: "WAITING",
    output: { isWaitingReply: true, resumeSameNode: true, state, eventNames: ["message-incoming"], timeoutMinutes },
  };
}

export function finishWith(chosenOutput: string, detail: Record<string, unknown> = {}): NodeExecutionResult {
  return { chosenOutput, output: { isWaitingReply: false, finishedBy: chosenOutput, ...detail } };
}

export function failed(error: unknown): NodeExecutionResult {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return { output: { isWaitingReply: false, error: errorMessage }, status: "FAILED", errorMessage };
}

export async function sendText(ref: LeadRef, context: WorkflowContext, nodeId: string, text: string): Promise<void> {
  await sendLinkToLead({ leadId: ref.leadId, trackingId: ref.trackingId, body: text, origin: flowOriginOf(context, nodeId) });
}

export async function saveLeadField(leadId: string, field: LeadFieldKey, value: string): Promise<void> {
  await prisma.lead.update({ where: { id: leadId }, data: { [field]: value } });
}

// ─── Pergunta ────────────────────────────────────────────────

export const askQuestionExecutor: NodeExecutor = async ({ nodeId, data, context, dryRun }) => {
  const config = parseAskQuestion(data);
  if (!config.question) return { output: { error: "question_missing" }, status: "FAILED", errorMessage: "Pergunta sem texto" };
  if (dryRun) return finishWith(ASK_QUESTION_OUTPUTS.answered, { dryRun: true });
  const ref = leadRefOf(context);
  if (!ref) return MISSING_LEAD;

  try {
    // Mesmas variáveis do Enviar mensagem: {{primeiro_nome}}, {{vars.cidade}}...
    const fillText = (await createMessageFiller(context, ref.leadId)) ?? ((text: string) => text);
    const waiting = waitingStateOf<{ attempts: number }>(nodeId, context);
    if (!waiting) {
      await sendText(ref, context, nodeId, fillText(config.question));
      await markAwaitingReply({ ...ref, nodeId, timeoutMinutes: config.replyDeadline.timeoutMinutes });
      return waitForReply({ attempts: 0 }, config.replyDeadline.timeoutMinutes);
    }

    const reply = readClientReply(context);
    if (reply.hasTimedOut) return config.replyDeadline.hasDeadline ? finishWith(ASK_QUESTION_OUTPUTS.noReply) : EXPIRED_RESULT;
    const value = config.answerType === "FILE" ? await photoAnswerOf(reply, ref.leadId) : validateAnswer(config.answerType, reply.text);
    if (value === null) {
      const attempts = waiting.attempts + 1;
      if (attempts >= config.maxAttempts) return finishWith(ASK_QUESTION_OUTPUTS.invalid, { attempts });
      await sendText(ref, context, nodeId, fillText(config.invalidMessage));
      await markAwaitingReply({ ...ref, nodeId, timeoutMinutes: config.replyDeadline.timeoutMinutes });
      return waitForReply({ attempts }, config.replyDeadline.timeoutMinutes);
    }

    // Foto não vai para campo do lead: o valor é o id da mensagem.
    const saveToField = config.answerType === "FILE" ? null : config.saveToField;
    if (saveToField) await saveLeadField(ref.leadId, saveToField, value);
    const variableName = config.variableName || saveToField;
    return {
      chosenOutput: ASK_QUESTION_OUTPUTS.answered,
      output: {
        isWaitingReply: false,
        finishedBy: ASK_QUESTION_OUTPUTS.answered,
        ...(variableName ? { vars: { [variableName]: value } } : {}),
        ...(saveToField ? { lead: { [saveToField]: value } } : {}),
      },
    };
  } catch (error) {
    return failed(error);
  }
};

// ─── Randomizador ────────────────────────────────────────────

export const randomizerExecutor: NodeExecutor = async ({ data }) => {
  const chosen = pickRandomizerPath(parseRandomizerPaths(data), Math.random());
  if (!chosen) return { output: { error: "no_paths" }, status: "FAILED", errorMessage: "Randomizador sem caminhos com porcentagem" };
  return { chosenOutput: `${RANDOMIZER_OUTPUT_PREFIX}${chosen.id}`, output: { pathId: chosen.id, pathLabel: chosen.label } };
};

// ─── Distribuição ────────────────────────────────────────────

/**
 * Rodízio de verdade (CA-7): o atendente ativo que recebeu lead há mais tempo, com espaço na capacidade. A troca de
 * `lastAssignedAt` só vale se ninguém escolheu o mesmo atendente no meio: dois leads juntos não caem no mesmo.
 */
export const distributeExecutor: NodeExecutor = async ({ context, dryRun }) => {
  if (dryRun) return { chosenOutput: DISTRIBUTE_OUTPUTS.assigned, output: { dryRun: true } };
  const ref = leadRefOf(context);
  if (!ref) return MISSING_LEAD;
  try {
    const lead = await prisma.lead.findUnique({ where: { id: ref.leadId }, select: { tracking: { select: { organizationId: true } } } });
    if (!lead) return MISSING_LEAD;
    const { organizationId } = lead.tracking;
    const consultants = await prisma.trackingConsultant.findMany({
      where: { trackingId: ref.trackingId, isActive: true },
      orderBy: [{ lastAssignedAt: { sort: "asc", nulls: "first" } }],
      select: { id: true, userId: true, maxFlow: true, lastAssignedAt: true, user: { select: { name: true } } },
    });
    for (const consultant of consultants) {
      const load = await prisma.lead.count({
        where: consultantLoadWhere({ organizationId, trackingId: ref.trackingId, responsibleId: consultant.userId }),
      });
      if (load >= consultant.maxFlow) continue;
      const { count } = await prisma.trackingConsultant.updateMany({
        where: { id: consultant.id, lastAssignedAt: consultant.lastAssignedAt },
        data: { lastAssignedAt: new Date() },
      });
      if (count === 0) continue;
      await prisma.lead.update({
        where: { id: ref.leadId },
        data: { responsibleId: consultant.userId, assignedAt: new Date(), ...assignedStatusFlowPatch(organizationId) },
      });
      return {
        chosenOutput: DISTRIBUTE_OUTPUTS.assigned,
        output: { vars: { atendente: consultant.user.name }, responsibleId: consultant.userId },
      };
    }
    return { chosenOutput: DISTRIBUTE_OUTPUTS.noAttendant, output: { consultants: consultants.length } };
  } catch (error) {
    return failed(error);
  }
};

// ─── Finalizar ───────────────────────────────────────────────

export const finishAttendanceExecutor: NodeExecutor = async ({ data, context, dryRun }) => {
  const { endFlow, columns } = parseColumnMove(data);
  const ref = leadRefOf(context);
  const statusId = ref ? columns[ref.trackingId] : undefined;
  if (dryRun || !ref || !statusId) return { output: { endFlow } };
  try {
    // Só move dentro do funil do próprio lead: coluna de outro funil é ignorada.
    const status = await prisma.status.findFirst({ where: { id: statusId, trackingId: ref.trackingId }, select: { id: true } });
    if (status) await prisma.lead.update({ where: { id: ref.leadId }, data: { statusId: status.id, lastStatusChangeAt: new Date() } });
    return { output: { endFlow, movedTo: status?.id ?? null } };
  } catch (error) {
    return { output: { endFlow, error: error instanceof Error ? error.message : String(error) } };
  }
};

// ─── Agente de IA ────────────────────────────────────────────

interface AiAgentState {
  replies: number;
}

export const aiAgentExecutor: NodeExecutor = async ({ nodeId, data, context, dryRun }) => {
  const config = parseAiAgent(data);
  if (dryRun) return finishWith(AI_AGENT_OUTPUTS.objectiveDone, { dryRun: true });
  const ref = leadRefOf(context);
  if (!ref) return MISSING_LEAD;

  const waiting = waitingStateOf<AiAgentState>(nodeId, context);
  const replies = waiting?.replies ?? 0;
  if (waiting) {
    const reply = readClientReply(context);
    if (reply.hasTimedOut) return config.replyDeadline.hasDeadline ? finishWith(AI_AGENT_OUTPUTS.noReply, { replies }) : EXPIRED_RESULT;
    if (replies >= config.maxReplies) return finishWith(AI_AGENT_OUTPUTS.maxReplies, { replies });
  }

  try {
    const { runAiFlowBlockTurn } = await import("@/features/tracking-chat-ai/lib/flow-block-agent");
    const fillText = (await createMessageFiller(context, ref.leadId)) ?? ((text: string) => text);
    const turn = await runAiFlowBlockTurn({
      leadId: ref.leadId,
      trackingId: ref.trackingId,
      block: {
        ...config,
        instructions: fillText(config.instructions),
        goal: fillText(config.goal),
        assistant: config.assistant ? { ...config.assistant, prompt: fillText(config.assistant.prompt) } : null,
      },
      // O que o fluxo já perguntou não deve ser perguntado de novo pela IA.
      knownValues: flowVariablesOf(context),
      origin: flowOriginOf(context, nodeId),
      // Espera o cliente terminar de digitar antes de responder (CB-15); na entrada do bloco responde na hora.
      waitForMoreMessagesMs: waiting ? 3000 : 0,
    });
    const capturedVars = turn.capturedValues;
    if (turn.kind === "error") return { ...finishWith(AI_AGENT_OUTPUTS.error, { replies, reason: turn.reason }), output: { isWaitingReply: false, error: turn.reason, vars: capturedVars } };
    if (turn.exitOutput) {
      return { chosenOutput: turn.exitOutput, output: { isWaitingReply: false, finishedBy: turn.exitOutput, replies: replies + 1, vars: capturedVars }, starsSpent: turn.starsSpent };
    }
    const nextReplies = replies + 1;
    await markAwaitingReply({ ...ref, nodeId, timeoutMinutes: config.replyDeadline.timeoutMinutes });
    return {
      status: "WAITING",
      starsSpent: turn.starsSpent,
      output: {
        isWaitingReply: true,
        resumeSameNode: true,
        state: { replies: nextReplies } satisfies AiAgentState,
        eventNames: ["message-incoming"],
        timeoutMinutes: config.replyDeadline.timeoutMinutes,
        vars: capturedVars,
      },
    };
  } catch (error) {
    return { ...failed(error), chosenOutput: AI_AGENT_OUTPUTS.error, status: "SUCCESS" };
  }
};

export const ATTENDANCE_EXECUTORS: [string, NodeExecutor][] = [
  ["ASK_QUESTION", askQuestionExecutor],
  ["RANDOMIZER", randomizerExecutor],
  ["DISTRIBUTE", distributeExecutor],
  ["FINISH_ATTENDANCE", finishAttendanceExecutor],
  ["AI_AGENT", aiAgentExecutor],
];
