import "server-only";
import { runAstroQuery } from "@/features/astro/queries/registry";
import {
  isAwaitingAnswer,
  shouldSkipReading,
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
import type { BotButton } from "./types";
import type { AstroPicker } from "@/features/astro/lib/astro-picker";
import { ANSWER_ID_PREFIX, MENU_END_ID, MENU_ROOT_ID } from "./menu/menu-tree";

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
  const totalRows = table.totalCount ?? table.rows.length;
  const rest = totalRows > MAX_TABLE_ROWS ? `\n_e mais ${totalRows - MAX_TABLE_ROWS}_` : "";
  return `${rows.join("\n")}${rest}`;
}

/** Escolha vira lista numerada: o canal canônico não manda botão. */
function optionsToText(options: { label: string }[]): string {
  return options.map((option, index) => `${index + 1}. ${option.label}`).join("\n");
}

// "1" e "2" entram porque a confirmação chega como lista numerada — o canal
// não entrega botão. Sem isso o usuário respondia "1", nada acontecia, e uma
// proposta nova era criada a cada tentativa.
const YES = /^(1|sim|s|confirmar|confirma|confirmo|pode|ok|isso|positivo|👍)$/;
const NO = /^(2|nao|n|cancela|cancelar|negativo|👎)$/;

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
    // No WhatsApp só link absoluto abre; os relativos ficam de fora.
    const absoluteLinks = (result.links ?? []).filter((link) => /^https?:\/\//.test(link.href)).map((link) => `${link.label}: ${link.href}`);
    return {
      reply: [result.ok ? `✅ ${result.summary}` : `⚠️ ${result.summary}`, ...absoluteLinks].join("\n"),
      buttons: AFTER_DONE_BUTTONS,
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
    // Na tela o campo já vem preenchido com a sugestão; no WhatsApp ela precisa estar escrita.
    const suggestion = output.picker?.kind === "text" ? output.picker.suggestion?.trim() : undefined;
    return toWhatsappWording(output.description) + (suggestion ? `\nSugestão: "${suggestion}"` : "");
  }
  return `⚠️ ${output.description}`;
}

/**
 * O id do botão é a resposta que a pessoa teria digitado na lista numerada ("2"): o clique
 * entra pelo mesmo caminho, sem depender do título, que a Meta devolve encurtado (spec 0079, RF-14).
 */
function toAnswerButtons(options: { label: string }[]): BotButton[] {
  return options.map((option, index) => ({ id: `${ANSWER_ID_PREFIX}${index + 1}`, text: option.label }));
}

/**
 * Atalhos da pergunta que na plataforma abre um seletor (spec 0079): dia, opção fixa, "sem lead".
 * O id é a resposta que a pessoa digitaria. Só onde há botão de verdade: em lista numerada,
 * "1" não seria entendido como "hoje".
 */
/** Id de botão da Meta: 256 caracteres; sobra para o prefixo. */
const MAX_ANSWER_ID_LENGTH = 180;

function pickerShortcutButtons(picker: AstroPicker | undefined): BotButton[] | undefined {
  if (!picker) return undefined;
  const answerButton = (label: string, answer: string): BotButton => ({
    id: `${ANSWER_ID_PREFIX}${answer}`,
    // Botão da Meta aceita 20 caracteres: "Sem lead (compromisso interno)" vira "Sem lead".
    text: label.replace(/\s*\(.*\)\s*$/, ""),
    interactiveOnly: true,
  });
  if (picker.kind === "select") return picker.options.map((option) => answerButton(option.label, option.answer));
  if (picker.kind === "datetime") {
    if (picker.mode === "time") return undefined;
    return [
      answerButton("Hoje", "hoje"),
      answerButton("Amanhã", "amanhã"),
      ...(picker.skipOption ? [answerButton(picker.skipOption.label, picker.skipOption.answer)] : []),
    ];
  }
  if (picker.kind === "entity") return picker.noneOption ? [answerButton(picker.noneOption.label, picker.noneOption.answer)] : undefined;
  const textButtons = [
    ...(picker.suggestion?.trim() ? [answerButton("Usar sugestão", picker.suggestion.trim().slice(0, MAX_ANSWER_ID_LENGTH))] : []),
    ...(picker.skipOption ? [answerButton(picker.skipOption.label, picker.skipOption.answer)] : []),
  ];
  return textButtons.length > 0 ? textButtons : undefined;
}

/** As perguntas foram escritas para a tela, que tem busca e calendário; no WhatsApp a pessoa escreve. */
function toWhatsappWording(description: string): string {
  return description
    .replace(/\s*Busque abaixo\./g, " Escreva o nome de novo, como está cadastrado.")
    .replace(/Busque o lead ou marque como interno\./g, "Escreva o nome do lead, ou responda *sem lead* se for interno.")
    .replace(/Escolha o dia e o horário\./g, 'Ex.: "amanhã às 15h".')
    .replace(/Busque (o|a) (\w+)\./g, "Escreva o nome d$1 $2.");
}

const AFTER_DONE_BUTTONS: BotButton[] = [
  { id: MENU_ROOT_ID, text: "Menu", interactiveOnly: true },
  { id: MENU_END_ID, text: "Encerrar", interactiveOnly: true },
];

export interface CheapLayerReply {
  reply: string;
  /** Opções da pergunta atual — viram botões no canal que aceita. */
  buttons?: BotButton[];
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

  // 0. "SIM"/"NÃO" respondendo a uma proposta pendente — só sem pergunta do
  // ciclo no ar. Com pergunta aberta, a resposta é dela: "sim" para "já foi
  // pago?" aprovava um post do Planner que esperava há horas, e "2" na lista
  // de contas cancelava uma proposta antiga.
  const confirmed = isAwaitingAnswer(sessionId)
    ? null
    : await tryConfirmation(params.ctx, text);
  if (confirmed) return confirmed;

  // 1. Consulta em código — custo zero. Pulada quando há pergunta no ar:
  // "despesa", respondendo a "despesa ou receita?", não é pedido de
  // relatório financeiro.
  const queried = shouldSkipReading(sessionId, text)
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
      buttons: toAnswerButtons(resolved.payload.options),
      route: "dropdown",
      actionKey: resolved.actionKey,
      tokensUsed,
    };
  }

  const output = resolved.output;
  const buttons = ((): BotButton[] | undefined => {
    if ("kind" in output) {
      // Confirmação também merece toque: digitar "sim" é o atrito mais bobo do fluxo inteiro.
      // Em lista numerada o texto já diz "responda SIM ou NÃO", então os botões não se repetem lá.
      return [
        { id: `${ANSWER_ID_PREFIX}sim`, text: "Confirmar", interactiveOnly: true },
        { id: `${ANSWER_ID_PREFIX}não`, text: "Cancelar", interactiveOnly: true },
      ];
    }
    if (output.status === "ambiguous") return toAnswerButtons(output.options);
    if (output.status === "done") return AFTER_DONE_BUTTONS;
    if (output.status === "needs_input") return pickerShortcutButtons(output.picker);
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
