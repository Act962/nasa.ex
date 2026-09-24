import "server-only";
import { runAstroQuery } from "@/features/astro/queries/registry";
import {
  hasGuidedSlot,
  resolveGuided,
  takeLastTokensUsed,
} from "@/features/astro/actions/guided-slots";
import {
  isConfirmation,
  type ClassifiedOutput,
} from "@/features/astro/actions/resolve-action";
import type { AstroTablePayload } from "@/features/astro/lib/astro-table";
import type { AgentContext } from "@/features/astro/server/agents/types";

/**
 * As camadas baratas do Astro, faladas em WhatsApp.
 *
 * O widget já respondia "quantos leads temos" com `count()` e executava os 26
 * verbos sem IA; pelo WhatsApp o mesmo pedido ia ao orquestrador, custava
 * caro e voltava "não consegui montar uma resposta". A inteligência era a
 * mesma — só não alcançava este canal.
 *
 * A decisão continua em `resolve-action.ts`; aqui só se traduz o resultado
 * para texto, porque o WhatsApp não tem cartão nem botão.
 */

const MAX_TABLE_ROWS = 10;

/** Tabela em texto: "• Nome — 4 leads". Cartão não existe no WhatsApp. */
function tableToText(table: AstroTablePayload): string {
  const rows = table.rows.slice(0, MAX_TABLE_ROWS).map((row) => {
    const parts = table.columns
      .map((column) => {
        const value = row[column.key];
        if (value === null || value === undefined || value === "") return null;
        return column.key === table.columns[0].key
          ? String(value)
          : `${column.label}: ${value}`;
      })
      .filter(Boolean);
    return `• ${parts.join(" — ")}`;
  });
  const rest =
    table.rows.length > MAX_TABLE_ROWS
      ? `\n_e mais ${table.rows.length - MAX_TABLE_ROWS}_`
      : "";
  return `${rows.join("\n")}${rest}`;
}

/** Escolha vira lista numerada: o canal canônico não manda botão. */
function optionsToText(options: { label: string }[]): string {
  return options.map((option, index) => `${index + 1}. ${option.label}`).join("\n");
}

function outputToText(output: ClassifiedOutput): string {
  if (isConfirmation(output)) {
    const lines = output.lines
      .map((line) => `• ${line.label}: ${line.value}`)
      .join("\n");
    const warnings =
      output.warnings.length > 0
        ? `\n⚠️ ${output.warnings.join("\n⚠️ ")}`
        : "";
    return (
      `📝 *${output.title}*\n${lines}${warnings}\n\n` +
      "Responda *SIM* pra confirmar ou *NÃO* pra cancelar."
    );
  }
  if (output.status === "done") {
    const link = output.publicUrl ? `\n\n${output.publicUrl}` : "";
    return `✅ *${output.title}*\n${output.description}${link}`;
  }
  if (output.status === "ambiguous") {
    return `${output.description}\n\n${optionsToText(output.options)}`;
  }
  if (output.status === "needs_input") {
    return output.description;
  }
  return `⚠️ ${output.description}`;
}

export interface CheapLayerReply {
  reply: string;
  /** Vai para `WhatsappBotCommand.toolsCalled`, para o custo ficar visível. */
  route: string;
  actionKey?: string;
  tokensUsed: number;
}

/**
 * `null` = nenhuma camada barata atendeu; quem chama segue para o
 * orquestrador, que é o comportamento de sempre.
 */
export async function tryCheapLayers(params: {
  ctx: AgentContext;
  text: string;
  history: string[];
}): Promise<CheapLayerReply | null> {
  const text = params.text.trim();
  if (!text) return null;

  const sessionId = params.ctx.sessionId ?? params.ctx.organizationId;

  // 1. Consulta em código — custo zero. Pulada quando há pergunta no ar:
  // "despesa", respondendo a "despesa ou receita?", não é pedido de
  // relatório financeiro.
  const queried = hasGuidedSlot(sessionId)
    ? null
    : await runAstroQuery({
        ctx: params.ctx,
        text,
        history: params.history,
      });
  if (queried) {
    const table = queried.result.table ? `\n\n${tableToText(queried.result.table)}` : "";
    return {
      reply: `${queried.result.text}${table}`,
      route: `consulta:${queried.key}`,
      tokensUsed: 0,
    };
  }

  // 2. Verbo — classificado quando é pedido novo, continuado quando é
  // resposta ao que o Astro perguntou.
  const resolved = await resolveGuided({
    ctx: params.ctx,
    text,
    history: params.history,
    sessionId,
  });
  const tokensUsed = takeLastTokensUsed(sessionId);
  if (!resolved) return null;

  if (resolved.kind === "choice") {
    return {
      reply: `${resolved.payload.description}\n\n${optionsToText(resolved.payload.options)}`,
      route: "dropdown",
      actionKey: resolved.actionKey,
      tokensUsed,
    };
  }

  return {
    reply: outputToText(resolved.output),
    route: resolved.denied ? "denied" : "verbo",
    actionKey: resolved.action.key,
    tokensUsed,
  };
}
