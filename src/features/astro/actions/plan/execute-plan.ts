import "server-only";
import type { AgentContext } from "@/features/astro/server/agents/types";
import {
  registerProposalExecutor,
  type ProposalExecutionResult,
} from "@/features/astro/server/tools/_shared/proposals/types";
import type { AstroConfirmationPayload } from "@/features/astro/lib/astro-confirmation";
import { getAstroAction } from "../registry";
import { proposeAction } from "../confirmation";
import type { AstroActionResult } from "../types";

// Execução do plano confirmado (spec 0033, RF-7): parte a parte, na ordem,
// cada uma com ✅, ❌ ou ⏸. O resultado de uma alimenta a seguinte — o link da
// proposta vira a mensagem, o lead criado vira o lead da reunião.

export const PLAN_ACTION_TYPE = "astro:plan";

export interface PlanPayloadPart {
  actionKey: string;
  label: string;
  input?: Record<string, unknown>;
  failure?: string;
  dependsOn?: number;
  messageFrom?: number;
  destructive?: boolean;
}

function composeMessage(source: AstroActionResult | undefined): string | null {
  if (!source || source.status !== "done") return null;
  return source.publicUrl ? `Olá! Segue o link: ${source.publicUrl}` : `Olá! ${source.description}`;
}

async function runPart(
  ctx: AgentContext,
  part: PlanPayloadPart,
  results: (AstroActionResult | undefined)[],
): Promise<AstroActionResult> {
  const action = getAstroAction(part.actionKey);
  if (!action || !part.input) {
    return { status: "error", title: part.label, description: "Parte sem dados para executar.", appName: "Órbita" };
  }
  const input = { ...part.input };
  if (part.messageFrom !== undefined) {
    const message = composeMessage(results[part.messageFrom]);
    if (!message) {
      return { status: "error", title: part.label, description: "Sem o resultado da parte anterior.", appName: "Órbita" };
    }
    input.message = message;
  }
  const parsed = action.input.safeParse(input);
  if (!parsed.success) {
    return { status: "error", title: part.label, description: "Os dados desta parte não são mais válidos.", appName: "Órbita" };
  }
  return action.execute({ ctx, input: parsed.data });
}

async function executePlan(ctx: AgentContext, parts: PlanPayloadPart[]): Promise<ProposalExecutionResult> {
  const results: (AstroActionResult | undefined)[] = [];
  const lines: { label: string; value: string }[] = [];
  let doneCount = 0;
  let followUp: AstroConfirmationPayload | undefined;

  for (const [index, part] of parts.entries()) {
    const label = `${index + 1}. ${part.label}`;
    if (part.failure) {
      lines.push({ label, value: `❌ ${part.failure}` });
      continue;
    }
    if (part.dependsOn !== undefined && results[part.dependsOn]?.status !== "done") {
      lines.push({ label, value: `⏸ Não executada porque a parte ${part.dependsOn + 1} não deu certo.` });
      continue;
    }
    if (part.destructive) {
      // Apagar nunca vai no embalo do plano: ganha cartão próprio, agora.
      const action = getAstroAction(part.actionKey);
      const proposed = action && part.input
        ? await proposeAction({ ctx, action, input: part.input, warnings: action.confirmWarnings })
        : null;
      if (proposed && "kind" in proposed) {
        followUp = proposed;
        lines.push({ label, value: "⏳ Aguardando sua confirmação no cartão abaixo." });
      } else {
        lines.push({ label, value: `❌ ${proposed?.description ?? "Não consegui preparar esta parte."}` });
      }
      continue;
    }

    try {
      const result = await runPart(ctx, part, results);
      results[index] = result;
      if (result.status === "done") doneCount++;
      lines.push({ label, value: result.status === "done" ? `✅ ${result.description}` : `❌ ${result.description}` });
    } catch (error) {
      console.error("[astro/plan] parte falhou", error);
      lines.push({ label, value: `❌ ${error instanceof Error ? error.message : "Erro ao executar."}` });
    }
  }

  const publicLinks = results
    .filter((result): result is Extract<AstroActionResult, { status: "done" }> => result?.status === "done")
    .filter((result) => result.publicUrl)
    .map((result) => ({ label: result.title, href: result.publicUrl! }));

  return {
    ok: doneCount > 0,
    summary: `${doneCount} de ${parts.length} partes feitas.\n${lines.map((line) => `${line.label}: ${line.value}`).join("\n")}`,
    lines,
    links: publicLinks.length > 0 ? publicLinks : undefined,
    followUp,
  };
}

registerProposalExecutor(PLAN_ACTION_TYPE, async ({ ctx, payload }) => {
  const parts = (payload as { parts?: PlanPayloadPart[] }).parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    return { ok: false, summary: "Plano vazio." };
  }
  return executePlan(ctx, parts);
});
