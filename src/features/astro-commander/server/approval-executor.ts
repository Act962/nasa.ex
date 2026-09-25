import "server-only";
import type { Tool } from "ai";
import prisma from "@/lib/prisma";
import { registerProposalExecutor } from "@/features/astro/server/tools/_shared/proposals/types";
import { buildAstroAgent } from "@/features/astro/server/orchestrator";
import { COMMAND_TOOL_ACTION_TYPE } from "./tool-guard";
import { buildCommandContext, resolveAllowedTools } from "./command-agent";

/**
 * Executor das propostas criadas por ferramenta de comando (spec 0023, RF-4).
 *
 * Quando alguém aprova na fila, a ferramenta original roda agora — sem o
 * porteiro do `tool-guard`, que é exatamente o que a aprovação dispensa.
 */

interface CommandToolPayload {
  commandId?: string;
  toolName?: string;
  input?: unknown;
}

function summarize(result: unknown): string {
  if (typeof result === "string") return result.slice(0, 500);
  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    for (const key of ["summary", "message", "error"]) {
      if (typeof record[key] === "string") return (record[key] as string).slice(0, 500);
    }
  }
  return "Ação executada.";
}

registerProposalExecutor<CommandToolPayload>(
  COMMAND_TOOL_ACTION_TYPE,
  async ({ ctx, payload }) => {
    if (!payload.commandId || !payload.toolName) {
      return { ok: false, summary: "Proposta sem comando ou ferramenta." };
    }

    const command = await prisma.astroCommand.findUnique({
      where: { id: payload.commandId },
    });
    if (!command || command.organizationId !== ctx.organizationId) {
      return { ok: false, summary: "Comando não encontrado nesta organização." };
    }

    const agent = await buildAstroAgent({
      ctx: buildCommandContext(command, ctx.userId),
      lastUserText: command.instruction,
      allowedTools: resolveAllowedTools(command),
    });

    const definition = agent.tools[payload.toolName] as Tool | undefined;
    const execute = definition?.execute;
    if (typeof execute !== "function") {
      return {
        ok: false,
        summary: `A ferramenta "${payload.toolName}" não está mais disponível para este comando.`,
      };
    }

    const result = await (execute as (input: unknown, options: unknown) => unknown)(
      payload.input,
      { toolCallId: `approval-${payload.commandId}`, messages: [] },
    );

    const failed =
      result && typeof result === "object" && "error" in (result as object);
    return {
      ok: !failed,
      summary: summarize(result),
      data: { toolName: payload.toolName, commandId: payload.commandId },
    };
  },
);

/** Import com efeito colateral: registra o executor. */
export const COMMAND_APPROVAL_EXECUTOR_REGISTERED = true;
