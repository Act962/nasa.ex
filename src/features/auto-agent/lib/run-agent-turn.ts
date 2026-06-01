/**
 * Motor de execução de 1 turn do agente.
 *
 * Função PURA — retorna `TurnResult` descrevendo ações a executar.
 * Side effects (gravar no banco, chamar tools, debitar Stars) ficam em
 * `applyTurnResult` separado, pra facilitar teste + idempotência.
 *
 * Sequência:
 *  1. Salvaguardas (early exits): cooldown, budget, max attempts, stop word
 *  2. Carrega contexto (últimas msgs + lead + tracking via loadAgentContext)
 *  3. Avalia goal atual com LLM (completionCriteria atingido?)
 *  4. Se atingido: avança goal (onSuccess) — recursão
 *  5. Senão: LLM escolhe tool + params + texto da mensagem
 *  6. Retorna actions + nextActionAt (próximo follow-up agendado)
 *
 * Goal avaliation + tool selection usam Astro existente — esse helper é
 * APENAS a orquestração de quando/o-quê. A geração de texto e function-call
 * são delegadas ao agent.ts existente do tracking-chat-ai (estendido pra
 * receber spec do goal como contexto extra).
 */

import type {
  Agent,
  Lead,
  LeadAgentSession,
  LeadAgentSessionStatus,
} from "@/generated/prisma/client";
import type { AgentSpec, AgentGoal } from "./agent-spec.schema";

export type TurnAction =
  | {
      type: "send_message";
      message: string;
      /// Tool name específico (sendMessage, sendButtons, etc) se aplicável
      tool?: string;
    }
  | {
      type: "execute_tool";
      tool: string;
      params: Record<string, unknown>;
      starsCost: number;
    }
  | {
      type: "add_tags";
      tagNames: string[];
    }
  | {
      type: "move_lead_to_status";
      statusId: string;
    }
  | {
      type: "move_lead_to_tracking";
      trackingId: string;
      statusId?: string;
    }
  | {
      type: "transfer_to_human";
      reason: string;
    }
  | {
      type: "advance_goal";
      nextGoalId: string;
    };

export type TurnResult = {
  /// Lista de ações a aplicar (em ordem)
  actions: TurnAction[];
  /// Status final da sessão após esse turn
  statusUpdate: LeadAgentSessionStatus;
  /// Próxima ação agendada (null = sem agendamento, ex: TRANSFERRED/COMPLETED)
  nextActionAt: Date | null;
  /// Razão de exit se status virou terminal
  exitReason?: string;
  /// attemptCount incrementado depois desse turn
  newAttemptCount: number;
  /// starsSpent incrementado depois desse turn
  starsToCharge: number;
  /// currentGoalId após o turn (pode ter avançado)
  currentGoalId: string;
};

export type RunAgentTurnInput = {
  agent: Agent;
  session: LeadAgentSession;
  lead: Lead;
  /// Mensagem recebida do lead nesse turno (null = follow-up agendado sem reply)
  incomingMessage?: string | null;
  /// História recente de mensagens (carregada por loadAgentContext)
  conversationHistory: Array<{ role: "lead" | "agent"; text: string; at: Date }>;
};

/**
 * Helper interno: detecta stop word case-insensitive em qualquer parte do
 * `incomingMessage`. Tolera variações comuns ("não quero", "n quero", etc).
 */
function detectStopWord(
  message: string | null | undefined,
  stopWords: string[],
): string | null {
  if (!message) return null;
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  for (const sw of stopWords) {
    const swNorm = sw
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    if (normalized.includes(swNorm)) return sw;
  }
  return null;
}

/**
 * Calcula próximo follow-up baseado em followUpSchedule[attemptCount].
 * Se attemptCount excedeu o array, retorna null (deve marcar COMPLETED).
 */
function calculateNextActionAt(
  agent: Agent,
  attemptCount: number,
): Date | null {
  if (attemptCount >= agent.followUpSchedule.length) return null;
  if (attemptCount >= agent.maxAttempts) return null;
  const daysAhead = agent.followUpSchedule[attemptCount];
  const next = new Date();
  next.setDate(next.getDate() + daysAhead);
  return next;
}

/**
 * Roda 1 turn. Aplicação real das actions fica em `applyTurnResult`
 * (separado pra ser idempotente em retry do Inngest).
 *
 * Esse stub é a Fase 1 — só lógica de salvaguardas + estrutura de retorno.
 * Integração com LLM (Astro) pra avaliar goal + escolher tool fica na Fase 2.
 */
export function runAgentTurn(input: RunAgentTurnInput): TurnResult {
  const { agent, session, lead, incomingMessage } = input;
  const spec = agent.spec as unknown as AgentSpec;
  const currentGoal: AgentGoal | undefined = session.currentGoalId
    ? spec.goals.find((g) => g.id === session.currentGoalId)
    : spec.goals[0]; // entry point

  // ── Salvaguarda 1: Stop word no input do lead ──────────────────────────
  const stopWords = spec.stopWords ?? agent.stopWords;
  const sw = detectStopWord(incomingMessage, stopWords);
  if (sw) {
    return {
      actions: [
        { type: "add_tags", tagNames: ["opt-out"] },
        { type: "transfer_to_human", reason: `Stop word detectada: "${sw}"` },
      ],
      statusUpdate: "TRANSFERRED",
      nextActionAt: null,
      exitReason: "stop_word",
      newAttemptCount: session.attemptCount,
      starsToCharge: 0,
      currentGoalId: currentGoal?.id ?? "",
    };
  }

  // ── Salvaguarda 2: Budget Stars excedido ───────────────────────────────
  if (session.starsSpent >= agent.maxStarsPerLead) {
    return {
      actions: [
        { type: "transfer_to_human", reason: "Budget de Stars excedido" },
      ],
      statusUpdate: "TRANSFERRED",
      nextActionAt: null,
      exitReason: "budget_exceeded",
      newAttemptCount: session.attemptCount,
      starsToCharge: 0,
      currentGoalId: currentGoal?.id ?? "",
    };
  }

  // ── Salvaguarda 3: Cooldown ────────────────────────────────────────────
  if (session.lastActionAt) {
    const cooldownEnd = new Date(
      session.lastActionAt.getTime() + agent.cooldownMinutes * 60_000,
    );
    if (cooldownEnd > new Date()) {
      // Cooldown ativo — reagenda pro fim do cooldown sem agir
      return {
        actions: [],
        statusUpdate: "WAITING",
        nextActionAt: cooldownEnd,
        newAttemptCount: session.attemptCount,
        starsToCharge: 0,
        currentGoalId: currentGoal?.id ?? "",
      };
    }
  }

  // ── Salvaguarda 4: Max tentativas atingido ─────────────────────────────
  if (session.attemptCount >= agent.maxAttempts) {
    return {
      actions: [],
      statusUpdate: "COMPLETED",
      nextActionAt: null,
      exitReason: "max_attempts",
      newAttemptCount: session.attemptCount,
      starsToCharge: 0,
      currentGoalId: currentGoal?.id ?? "",
    };
  }

  // ── Sem goal definido (spec vazio) — completar sessão ──────────────────
  if (!currentGoal) {
    return {
      actions: [],
      statusUpdate: "COMPLETED",
      nextActionAt: null,
      exitReason: "no_active_goal",
      newAttemptCount: session.attemptCount,
      starsToCharge: 0,
      currentGoalId: "",
    };
  }

  // ── Fase 1: stub — apenas agenda próximo follow-up sem chamar LLM ──────
  // Integração real com Astro pra escolher tool/mensagem fica na Fase 2.
  // Por enquanto retorna estrutura básica pra schema compilar e testes.
  const nextAt = calculateNextActionAt(agent, session.attemptCount + 1);
  return {
    actions: [],
    statusUpdate: nextAt ? "WAITING" : "COMPLETED",
    nextActionAt: nextAt,
    exitReason: nextAt ? undefined : "max_attempts",
    newAttemptCount: session.attemptCount + 1,
    starsToCharge: 0,
    currentGoalId: currentGoal.id,
  };
}
