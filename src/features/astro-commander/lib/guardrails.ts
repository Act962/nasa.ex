import "server-only";
import prisma from "@/lib/prisma";
import type { AstroCommand } from "@/generated/prisma/client";

/**
 * Guardrails do ASTRO COMMANDER (spec 0028, RF-6 / CA-7 / CA-9). Tudo aqui
 * roda ANTES de chamar o LLM: barrar depois já custou tokens.
 */

export type GuardrailVerdict =
  | { allowed: true }
  | { allowed: false; status: "SKIPPED_LIMIT" | "SKIPPED"; reason: string };

const ALLOWED = { allowed: true } as const;

/** Janela de horário permitida, guardada em `executionConfig`. */
interface ExecutionWindow {
  startHour?: number;
  endHour?: number;
  weekdaysOnly?: boolean;
}

export function readExecutionWindow(command: AstroCommand): ExecutionWindow {
  const config = command.executionConfig as Record<string, unknown> | null;
  const window = config?.window as ExecutionWindow | undefined;
  return window ?? {};
}

function isInsideWindow(window: ExecutionWindow, now: Date, timezone: string): boolean {
  if (window.startHour === undefined && window.endHour === undefined && !window.weekdaysOnly) {
    return true;
  }
  const local = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  if (window.weekdaysOnly) {
    const weekday = local.getDay();
    if (weekday === 0 || weekday === 6) return false;
  }
  const hour = local.getHours();
  if (window.startHour !== undefined && hour < window.startHour) return false;
  if (window.endHour !== undefined && hour >= window.endHour) return false;
  return true;
}

/**
 * Checa, em ordem do mais barato para o mais caro: estado do comando, pausa da
 * organização, janela de horário e teto de execuções do dia.
 */
export async function checkGuardrails(params: {
  command: AstroCommand;
  now?: Date;
  /** Execução manual ou de teste ignora janela de horário. */
  ignoreWindow?: boolean;
}): Promise<GuardrailVerdict> {
  const { command } = params;
  const now = params.now ?? new Date();

  if (command.status === "ARCHIVED") {
    return { allowed: false, status: "SKIPPED", reason: "Comando arquivado." };
  }
  if (command.status === "PAUSED") {
    return {
      allowed: false,
      status: "SKIPPED",
      reason: command.pausedReason
        ? `Comando pausado: ${command.pausedReason}`
        : "Comando pausado.",
    };
  }

  const organization = await prisma.organization.findUnique({
    where: { id: command.organizationId },
    select: { astroCommanderPausedAt: true, starsSuspendedAt: true },
  });
  if (organization?.astroCommanderPausedAt) {
    return {
      allowed: false,
      status: "SKIPPED",
      reason: "Os comandos desta organização estão pausados.",
    };
  }
  if (organization?.starsSuspendedAt) {
    return {
      allowed: false,
      status: "SKIPPED_LIMIT",
      reason: "Conta suspensa por falta de Stars.",
    };
  }

  if (!params.ignoreWindow && !isInsideWindow(readExecutionWindow(command), now, command.timezone)) {
    return {
      allowed: false,
      status: "SKIPPED",
      reason: "Fora da janela de horário permitida para este comando.",
    };
  }

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const runsToday = await prisma.astroCommandRun.count({
    where: {
      commandId: command.id,
      startedAt: { gte: startOfDay },
      // Execução barrada por limite não conta para o próprio limite.
      status: { notIn: ["SKIPPED_LIMIT", "SKIPPED"] },
    },
  });
  if (runsToday >= command.maxRunsPerDay) {
    return {
      allowed: false,
      status: "SKIPPED_LIMIT",
      reason: `Limite de ${command.maxRunsPerDay} execuções por dia atingido.`,
    };
  }

  return ALLOWED;
}

/**
 * Tools que mexem em dinheiro. Exigem aprovação em qualquer modo de autonomia
 * (spec 0028, RF-4 / CA-4) — o modo `AUTO` não vale para elas.
 */
const FINANCIAL_TOOL_PATTERN =
  /(payment|finance|financeir|boleto|pix|invoice|charge|cobran|pagar|pagamento|lancamento|lançamento|reconcil|concilia|transfer)/i;

export function isFinancialTool(toolName: string): boolean {
  return FINANCIAL_TOOL_PATTERN.test(toolName);
}

/**
 * Decide se uma tool precisa de aprovação humana nesta execução.
 * Ordem: financeira sempre → marcação explícita do comando → modo de autonomia.
 */
export function requiresApproval(params: {
  toolName: string;
  autonomy: AstroCommand["autonomy"];
  toolApprovals: Record<string, boolean>;
  /** Valor envolvido na ação, quando a tool informa um. */
  amount?: number;
  approvalThreshold?: number | null;
}): boolean {
  if (isFinancialTool(params.toolName)) return true;
  if (params.toolApprovals[params.toolName]) return true;
  if (params.autonomy === "DRAFT") return true;
  if (params.autonomy === "AUTO") return false;
  // APPROVE_ABOVE: sem valor declarado, erra para o lado seguro.
  if (params.amount === undefined) return true;
  const threshold = params.approvalThreshold ?? 0;
  return params.amount > threshold;
}
