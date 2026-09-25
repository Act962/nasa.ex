import "server-only";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { createPendingAction } from "@/features/astro/server/tools/_shared/proposals/create-proposal";
import {
  registerProposalExecutor,
  type ProposalExecutionResult,
} from "@/features/astro/server/tools/_shared/proposals/types";
import type { AstroConfirmationPayload } from "@/features/astro/lib/astro-confirmation";
import { ASTRO_ACTIONS, getAstroAction } from "./registry";
import { labelFor } from "./resolve-action";
import type { AstroAction, AstroActionResult } from "./types";

/**
 * Ponte entre o registro de ações e a confirmação que já existia (spec 0014).
 *
 * O `requiresConfirmation` das ações estava declarado e ninguém lia: a RF-8 da
 * spec 0023 não saía do papel, e a escrita acontecia direto. Aqui ele passa a
 * valer nos dois caminhos — classificador e orquestrador.
 */

const ACTION_TYPE_PREFIX = "registry:";

function actionTypeFor(action: AstroAction): string {
  return `${ACTION_TYPE_PREFIX}${action.key}`;
}

/**
 * Transforma os campos em linhas legíveis. O nome do campo no código não é
 * palavra de gente: o cartão mostrava "accountName" e "amount" para quem só
 * queria conferir a conta e o valor.
 */
function linesFor(input: Record<string, unknown>) {
  return Object.entries(input)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .slice(0, 8)
    .map(([key, value]) => ({
      label: capitalize(labelFor(key).replace(/^(o|a|os|as|se) /, "")),
      value: displayValue(value),
    }));
}

/** Valor que o código entende, dito como gente fala. */
const VALUE_LABELS: Record<string, string> = {
  PAYABLE: "Despesa",
  expense: "Despesa",
  cost: "Despesa",
  despesa: "Despesa",
  RECEIVABLE: "Receita",
  revenue: "Receita",
  income: "Receita",
  receita: "Receita",
  true: "Sim",
  false: "Não",
  tracking: "Tracking (leads)",
  workspace: "Workspace (tarefas)",
};

function displayValue(value: unknown): string {
  const raw = String(value);
  return VALUE_LABELS[raw] ?? raw;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Grava a intenção e devolve o cartão. Nada é escrito no domínio até o
 * usuário responder — é o que torna aceitável dar ao Astro ações destrutivas.
 */
export async function proposeAction(params: {
  ctx: AgentContext;
  action: AstroAction;
  input: Record<string, unknown>;
  warnings?: string[];
}): Promise<AstroConfirmationPayload | AstroActionResult> {
  // Ensaia primeiro: alvo inexistente, homônimo ou falta de permissão viram
  // resposta agora, não surpresa depois do "sim".
  const rehearsal = await params.action.execute({
    ctx: params.ctx,
    input: params.input,
    dryRun: true,
  });
  if (rehearsal.status !== "done") return rehearsal;

  return createPendingAction({
    ctx: params.ctx,
    actionType: actionTypeFor(params.action),
    payload: params.input,
    title: params.action.confirmTitle ?? `Confirmar: ${params.action.toolName}`,
    lines: linesFor(params.input),
    warnings: params.warnings,
  });
}

function toExecutionResult(result: AstroActionResult): ProposalExecutionResult {
  if (result.status === "done") {
    return {
      ok: true,
      summary: result.description,
      links: result.publicUrl
        ? [{ label: "Link do cliente", href: result.publicUrl }]
        : undefined,
      data: { publicUrl: result.publicUrl, internalUrl: result.internalUrl },
    };
  }
  return { ok: false, summary: result.description };
}

/**
 * Registra um executor por ação. Sem isto, `confirm_action` recebe o "sim" e
 * responde que não sabe executar — a confirmação viraria beco sem saída.
 */
export function registerRegistryExecutors(): void {
  for (const action of ASTRO_ACTIONS) {
    registerProposalExecutor(actionTypeFor(action), async ({ ctx, payload }) => {
      const target = getAstroAction(action.key);
      if (!target) {
        return { ok: false, summary: `Ação "${action.key}" não existe mais.` };
      }
      const parsed = target.input.safeParse(payload);
      if (!parsed.success) {
        return { ok: false, summary: "Os dados da confirmação não são mais válidos." };
      }
      return toExecutionResult(await target.execute({ ctx, input: parsed.data }));
    });
  }
}

registerRegistryExecutors();
