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
import prisma from "@/lib/prisma";
import { getProposalExecutor } from "@/features/astro/server/tools/_shared/proposals/types";
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

const YES = /^(sim|s|confirmar|confirma|confirmo|pode|ok|isso|positivo|👍)$/;
const NO = /^(nao|n|cancela|cancelar|negativo|para|deixa|👎)$/;

/**
 * "SIM" executa a proposta pendente aqui mesmo.
 *
 * Confirmar é a resposta mais previsível do fluxo e ia ao orquestrador só
 * para ele chamar uma ferramenta que nós podemos chamar direto. Custava um
 * turno caro no momento em que o usuário menos espera demora.
 */
async function tryConfirmation(
  ctx: AgentContext,
  text: string,
): Promise<CheapLayerReply | null> {
  const normalized = text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const isYes = YES.test(normalized);
  const isNo = NO.test(normalized);
  if (!isYes && !isNo) return null;

  const pending = await prisma.astroPendingAction.findFirst({
    where: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      channel: ctx.channel ?? "WHATSAPP",
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!pending) return null;

  if (isNo) {
    await prisma.astroPendingAction.update({
      where: { id: pending.id },
      data: { status: "CANCELLED", confirmedAt: new Date() },
    });
    return { reply: "Cancelado. Nada foi gravado.", route: "confirmacao", tokensUsed: 0 };
  }

  const executor = getProposalExecutor(pending.actionType);
  if (!executor) return null;

  try {
    const result = await executor({
      ctx,
      proposalId: pending.id,
      payload: pending.payload as Record<string, unknown>,
    });
    await prisma.astroPendingAction.update({
      where: { id: pending.id },
      data: {
        status: result.ok ? "CONFIRMED" : "FAILED",
        confirmedAt: new Date(),
        result: (result.data ?? { summary: result.summary }) as object,
        errorMessage: result.ok ? null : result.summary,
      },
    });
    return {
      reply: result.ok ? `✅ ${result.summary}` : `⚠️ ${result.summary}`,
      route: "confirmacao",
      tokensUsed: 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao executar";
    await prisma.astroPendingAction.update({
      where: { id: pending.id },
      data: { status: "FAILED", confirmedAt: new Date(), errorMessage: message },
    });
    return { reply: `⚠️ Não consegui executar: ${message}`, route: "confirmacao", tokensUsed: 0 };
  }
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
  /** Opções da pergunta atual — viram botões no canal que aceita. */
  buttons?: Array<{ id: string; text: string }>;
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

  // 0. "SIM"/"NÃO" respondendo a uma proposta pendente.
  const confirmed = await tryConfirmation(params.ctx, text);
  if (confirmed) return confirmed;

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
      reply: resolved.payload.description,
      buttons: resolved.payload.options.map((option) => ({
        id: option.id,
        text: option.label,
      })),
      route: "dropdown",
      actionKey: resolved.actionKey,
      tokensUsed,
    };
  }

  const output = resolved.output;
  const buttons = (() => {
    if ("kind" in output) {
      // Confirmação também merece toque: digitar "sim" é o atrito mais bobo
      // do fluxo inteiro.
      return [
        { id: "confirmar", text: "SIM" },
        { id: "cancelar", text: "NÃO" },
      ];
    }
    if (output.status === "ambiguous") {
      return output.options.map((option) => ({ id: option.id, text: option.label }));
    }
    return undefined;
  })();

  return {
    reply:
      !("kind" in output) && output.status === "ambiguous"
        ? output.description
        : outputToText(output),
    buttons,
    route: resolved.denied ? "denied" : "verbo",
    actionKey: resolved.action.key,
    tokensUsed,
  };
}
