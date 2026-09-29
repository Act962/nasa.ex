import "server-only";
import type { Tool, ToolSet } from "ai";
import type { AstroCommand } from "@/generated/prisma/client";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { createPendingAction } from "@/features/astro/server/tools/_shared/proposals/create-proposal";
import { requiresApproval } from "@/features/astro-commander/lib/guardrails";

/**
 * Porteiro das ferramentas numa execução headless (spec 0028, RF-4).
 *
 * O chat tem um humano olhando; o comando não. Então aqui toda ferramenta que
 * escreve passa por uma decisão explícita: executa agora ou vira proposta
 * pendente. Leitura passa direto.
 */

/** `actionType` das propostas criadas por ferramenta de comando. */
export const COMMAND_TOOL_ACTION_TYPE = "astro_command.tool";

/**
 * Proposta de comando espera a fila de aprovação, não alguém olhando a tela.
 * Três dias dão tempo de um fim de semana passar sem a ação expirar.
 */
const PENDING_TTL_MINUTES = 3 * 24 * 60;

/** Prefixos de ferramenta que mudam estado. O resto é leitura. */
const MUTATING_PREFIXES = [
  "create_",
  "update_",
  "delete_",
  "move_",
  "send_",
  "archive_",
  "rename_",
  "apply_",
  "mark_",
  "add_",
  "remove_",
  "assign_",
  "schedule_",
  "reschedule_",
  "cancel_",
  "publish_",
  "start_",
  "forward_",
  "generate_workflow",
  "sync_",
];

export function isMutatingTool(toolName: string): boolean {
  // Proposta já nasce pendente — é justamente o caminho seguro.
  if (toolName.startsWith("propose_")) return false;
  return MUTATING_PREFIXES.some((prefix) => toolName.startsWith(prefix));
}

/**
 * Ferramentas que o comando nunca enxerga. `confirm_action` fora da lista
 * deixaria o agente aprovar a própria proposta, que é o oposto do que a
 * aprovação humana existe para garantir.
 */
const FORBIDDEN_IN_HEADLESS = new Set([
  "confirm_action",
  "cancel_action",
  "list_pending_actions",
]);

export interface ToolGuardState {
  /** Propostas criadas nesta execução, para o run registrar. */
  pendingActionIds: string[];
  /** Ferramentas que foram barradas — vira resumo para o usuário. */
  heldTools: string[];
}

export function createToolGuardState(): ToolGuardState {
  return { pendingActionIds: [], heldTools: [] };
}

/** Valor envolvido na ação, quando a entrada da ferramenta declara um. */
function readAmount(input: unknown): number | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const record = input as Record<string, unknown>;
  for (const key of ["amount", "value", "valor", "total", "price"]) {
    const candidate = record[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
  }
  return undefined;
}

function describeInput(input: unknown): string {
  try {
    const text = JSON.stringify(input ?? {});
    return text.length > 400 ? `${text.slice(0, 400)}…` : text;
  } catch {
    return "";
  }
}

/**
 * Envolve o conjunto de ferramentas com a política do comando: remove o que não
 * pode existir sem humano, deixa a leitura passar e transforma a escrita que
 * exige aprovação em `AstroPendingAction`.
 */
export function guardToolsForCommand(params: {
  tools: ToolSet;
  command: AstroCommand;
  ctx: AgentContext;
  state: ToolGuardState;
  /** Execução de teste: nada sai, tudo vira proposta (RF-26). */
  testMode?: boolean;
}): ToolSet {
  const { tools, command, ctx, state } = params;
  const toolApprovals = (command.toolApprovals ?? {}) as Record<string, boolean>;
  const approvalThreshold = command.approvalThreshold
    ? Number(command.approvalThreshold)
    : null;

  const guarded: ToolSet = {};
  for (const [toolName, definition] of Object.entries(tools)) {
    if (FORBIDDEN_IN_HEADLESS.has(toolName)) continue;

    if (!isMutatingTool(toolName)) {
      guarded[toolName] = definition;
      continue;
    }

    const originalExecute = (definition as Tool).execute;
    if (typeof originalExecute !== "function") {
      guarded[toolName] = definition;
      continue;
    }

    guarded[toolName] = {
      ...definition,
      execute: async (input: unknown, options: unknown) => {
        const needsApproval =
          params.testMode ||
          requiresApproval({
            toolName,
            autonomy: command.autonomy,
            toolApprovals,
            amount: readAmount(input),
            approvalThreshold,
          });

        if (!needsApproval) {
          return (originalExecute as (input: unknown, options: unknown) => unknown)(
            input,
            options,
          );
        }

        const pending = await createPendingAction({
          ctx,
          actionType: COMMAND_TOOL_ACTION_TYPE,
          payload: { commandId: command.id, toolName, input },
          title: `${command.title} — ${toolName}`,
          lines: [
            { label: "Comando", value: command.title },
            { label: "Ação", value: toolName },
            { label: "Dados", value: describeInput(input) },
          ],
          warnings: params.testMode
            ? ["Execução de teste: nada foi enviado nem gravado."]
            : [],
          ttlMinutes: PENDING_TTL_MINUTES,
        });
        state.pendingActionIds.push(pending.proposalId);
        state.heldTools.push(toolName);

        return {
          status: "aguardando_aprovacao",
          proposalId: pending.proposalId,
          message:
            "Ação registrada para aprovação humana. NÃO tente confirmá-la: siga com o resto da tarefa ou finalize.",
        };
      },
    } as Tool;
  }

  return guarded;
}
