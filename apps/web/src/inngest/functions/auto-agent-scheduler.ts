import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import {
  runAgentTurn,
  type RunAgentTurnInput,
} from "@/features/auto-agent/lib/run-agent-turn";

/**
 * Scheduler do NASA Auto Agent — orquestra turns assíncronos via Inngest.
 *
 * Dois pontos de entrada (eventos):
 *
 *  1. `auto-agent/session-scheduled` — agendamento de follow-up.
 *     Função `autoAgentTickScheduledFn` dorme até `nextActionAt`, recheca
 *     a sessão (lead pode ter respondido), e roda turn.
 *
 *  2. `auto-agent/lead-replied` — lead mandou msg nova.
 *     Função `autoAgentOnLeadReplyFn` cancela qualquer sleep pendente e
 *     roda turn imediato com a msg como contexto.
 *
 * Cancelamento de sleep antigo: padrão event-driven do Inngest via
 * `cancelOn: { event: "auto-agent/lead-replied", match: "data.sessionId" }`.
 *
 * Concurrency: limit 100 — protege contra surto se org tem 1000+ leads
 * agendados pra mesmo minuto.
 */

interface SessionScheduledData {
  sessionId: string;
}

interface LeadRepliedData {
  sessionId: string;
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────
// A) Tick scheduled — dorme até nextActionAt e roda turn
// ─────────────────────────────────────────────────────────────────────────
export const autoAgentTickScheduledFn = inngest.createFunction(
  {
    id: "auto-agent-tick-scheduled",
    concurrency: { limit: 5 },
    // Cancela sleep se o lead responder antes do horário
    cancelOn: [
      {
        event: "auto-agent/lead-replied",
        match: "data.sessionId",
      },
      {
        event: "auto-agent/session-canceled",
        match: "data.sessionId",
      },
    ],
  },
  { event: "auto-agent/session-scheduled" },
  async ({ event, step }) => {
    const { sessionId } = event.data as SessionScheduledData;

    // 1. Carrega session pra saber quando dormir
    const session = await step.run("load-session", async () => {
      return prisma.leadAgentSession.findUnique({
        where: { id: sessionId },
        include: {
          agent: true,
          lead: { include: { tracking: true } },
        },
      });
    });

    if (!session || session.status !== "WAITING" || !session.nextActionAt) {
      return { skipped: true, reason: "session not waiting" };
    }

    // 2. Verifica pausa global da org (AiAgentConfig.enabled pra nasa-auto-agent)
    const globalConfig = await step.run("check-global-pause", async () => {
      return prisma.aiAgentConfig.findFirst({
        where: {
          organizationId: session.organizationId,
          agentKey: "nasa-auto-agent",
        },
        select: { enabled: true },
      });
    });

    if (globalConfig && !globalConfig.enabled) {
      // Pausa global ativa — reagenda pra 1h depois (re-check)
      const reCheckAt = new Date(Date.now() + 60 * 60 * 1000);
      await step.run("reschedule-on-pause", async () => {
        await prisma.leadAgentSession.update({
          where: { id: sessionId },
          data: { nextActionAt: reCheckAt },
        });
      });
      await step.sleepUntil("wait-pause-recheck", reCheckAt);
      await step.sendEvent("reenqueue-after-pause", {
        name: "auto-agent/session-scheduled",
        data: { sessionId },
      });
      return { paused: true, recheckAt: reCheckAt };
    }

    // 3. Sleep até nextActionAt
    await step.sleepUntil("wait-for-action", session.nextActionAt);

    // 4. Re-carrega session (estado pode ter mudado durante sleep)
    const fresh = await step.run("reload-after-sleep", async () => {
      return prisma.leadAgentSession.findUnique({
        where: { id: sessionId },
        include: {
          agent: true,
          lead: { include: { tracking: true } },
        },
      });
    });
    if (!fresh || fresh.status !== "WAITING") {
      return { skipped: true, reason: "session no longer waiting" };
    }
    if (!fresh.agent.isActive) {
      return { skipped: true, reason: "agent paused individually" };
    }

    // 5. Roda turn (Fase 1 stub — Fase 2 plug LLM via Astro)
    const result = await step.run("run-turn", async () => {
      // Inngest serializa Date→string no retorno de step.run; runAgentTurn é
      // puro e não lê campos de data desses objetos (só spec/limites), então
      // o cast é seguro.
      return runAgentTurn({
        agent: fresh.agent,
        session: fresh,
        lead: fresh.lead,
        incomingMessage: null,
        conversationHistory: [], // TODO: loadAgentContext na integração real
      } as unknown as RunAgentTurnInput);
    });

    // 6. Aplica resultado
    await step.run("apply-result", async () => {
      await prisma.leadAgentSession.update({
        where: { id: sessionId },
        data: {
          status: result.statusUpdate,
          attemptCount: result.newAttemptCount,
          nextActionAt: result.nextActionAt,
          lastActionAt: new Date(),
          starsSpent: { increment: result.starsToCharge },
          exitReason: result.exitReason ?? null,
          currentGoalId: result.currentGoalId || null,
          closedAt:
            result.statusUpdate === "COMPLETED" ||
            result.statusUpdate === "TRANSFERRED"
              ? new Date()
              : null,
        },
      });
    });

    // 7. Reenfileira se ainda waiting
    if (result.statusUpdate === "WAITING" && result.nextActionAt) {
      await step.sendEvent("reenqueue", {
        name: "auto-agent/session-scheduled",
        data: { sessionId },
      });
    }

    return {
      sessionId,
      status: result.statusUpdate,
      attemptCount: result.newAttemptCount,
    };
  },
);

// ─────────────────────────────────────────────────────────────────────────
// B) On lead reply — roda turn imediato com a mensagem como contexto
// ─────────────────────────────────────────────────────────────────────────
export const autoAgentOnLeadReplyFn = inngest.createFunction(
  { id: "auto-agent-on-lead-reply", concurrency: { limit: 5 } },
  { event: "auto-agent/lead-replied" },
  async ({ event, step }) => {
    const { sessionId, message } = event.data as LeadRepliedData;

    const session = await step.run("load-session-reply", async () => {
      return prisma.leadAgentSession.findUnique({
        where: { id: sessionId },
        include: {
          agent: true,
          lead: { include: { tracking: true } },
        },
      });
    });

    if (!session) return { skipped: true, reason: "session not found" };
    if (session.status === "COMPLETED" || session.status === "TRANSFERRED") {
      return { skipped: true, reason: "session terminal" };
    }
    if (!session.agent.isActive) {
      return { skipped: true, reason: "agent paused" };
    }

    const result = await step.run("run-turn-on-reply", async () => {
      return runAgentTurn({
        agent: session.agent,
        session,
        lead: session.lead,
        incomingMessage: message,
        conversationHistory: [],
      } as unknown as RunAgentTurnInput);
    });

    await step.run("apply-result-reply", async () => {
      await prisma.leadAgentSession.update({
        where: { id: sessionId },
        data: {
          status: result.statusUpdate,
          attemptCount: result.newAttemptCount,
          nextActionAt: result.nextActionAt,
          lastActionAt: new Date(),
          starsSpent: { increment: result.starsToCharge },
          exitReason: result.exitReason ?? null,
          currentGoalId: result.currentGoalId || null,
          closedAt:
            result.statusUpdate === "COMPLETED" ||
            result.statusUpdate === "TRANSFERRED"
              ? new Date()
              : null,
        },
      });
    });

    if (result.statusUpdate === "WAITING" && result.nextActionAt) {
      await step.sendEvent("reenqueue-after-reply", {
        name: "auto-agent/session-scheduled",
        data: { sessionId },
      });
    }

    return {
      sessionId,
      status: result.statusUpdate,
      reactedToMessage: true,
    };
  },
);
