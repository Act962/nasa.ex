import type { UIMessage } from "ai";
import { randomUUID } from "node:crypto";
import prisma from "../../src/lib/prisma";
import { runAstroQuery } from "../../src/features/astro/queries/registry";
import { clearGuidedSlot, isAwaitingAnswer, resolveGuided, shouldSkipReading } from "../../src/features/astro/actions/guided-slots";
import { isConfirmation } from "../../src/features/astro/actions/resolve-action";
import type { AstroActionResult } from "../../src/features/astro/actions/types";
import { streamAstro } from "../../src/features/astro/server/orchestrator";
import {
  cancelPendingAction,
  confirmPendingAction,
  decideLatestCardByText,
} from "../../src/features/astro/server/tools/_shared/proposals/confirm-direct";
import {
  extractConversationHistory,
  lastAssistantAsked,
} from "../../src/features/astro/lib/chat-turns";
import type { QaOrgContext } from "./qa-org";

// Uma conversa com o ASTRO, pela mesma ordem de camadas de
// `src/app/api/astro/chat/route.ts`: consulta em código → ciclo guiado →
// orquestrador. Sem HTTP e sem cobrança de Stars; o resto é o código real.

export type AstroLayer = "cartao" | "consulta" | "guiado" | "escolha" | "orquestrador";

const CARD_REPLY = /^(confirmar|cancelar)\s+[a-z0-9]{10,}$/i;

export interface AstroReply {
  layer: AstroLayer;
  /** Consulta ou ação que resolveu. Vazio no orquestrador. */
  key?: string;
  /** Texto para conferir — na consulta, inclui a tabela. */
  text: string;
  /** O que entra no histórico, como o widget guardaria. */
  historyText?: string;
  /** Resultado estruturado do ciclo guiado (cartão). */
  actionResult?: AstroActionResult;
  isConfirmationCard?: boolean;
  /** Linhas do cartão (plano) ou do relatório depois de confirmar. */
  confirmationLines?: { label: string; value: string }[];
  /** Id do cartão pendente — "confirmar <id>" executa, como no widget. */
  pendingActionId?: string;
  /** Ferramentas chamadas pelo orquestrador. */
  toolNames?: string[];
}

function textMessage(role: "user" | "assistant", text: string): UIMessage {
  return { id: randomUUID(), role, parts: [{ type: "text", text }] } as UIMessage;
}

export class AstroQaSession {
  private readonly messages: UIMessage[] = [];

  private constructor(
    private readonly qaOrg: QaOrgContext,
    readonly sessionId: string,
    private readonly userId: string,
  ) {}

  /** `userId` troca a persona (ex.: `qaOrg.sellerUserId`); padrão é o dono. */
  static async open(qaOrg: QaOrgContext, userId = qaOrg.ownerUserId): Promise<AstroQaSession> {
    const session = await prisma.aiSession.create({
      data: {
        organizationId: qaOrg.organizationId,
        userId,
        title: "Bateria de QA",
      },
      select: { id: true },
    });
    return new AstroQaSession(qaOrg, session.id, userId);
  }

  private get agentContext() {
    return {
      userId: this.userId,
      organizationId: this.qaOrg.organizationId,
      route: {},
      sessionId: this.sessionId,
      channel: "CHAT",
    } as never;
  }

  async send(text: string): Promise<AstroReply> {
    this.messages.push(textMessage("user", text));
    const reply = await this.route(text);
    this.messages.push(textMessage("assistant", reply.historyText ?? reply.text));
    return reply;
  }

  private async route(text: string): Promise<AstroReply> {
    const history = extractConversationHistory(this.messages);

    // Clique no cartão, resolvido em código antes de tudo (mesma regra da rota).
    if (CARD_REPLY.test(text.trim())) {
      const [decision, pendingActionId] = text.trim().split(/\s+/);
      if (/^cancelar$/i.test(decision)) {
        const outcome = await cancelPendingAction({ ctx: this.agentContext, proposalId: pendingActionId });
        return { layer: "cartao", text: "error" in outcome ? outcome.error : outcome.summary };
      }
      const outcome = await confirmPendingAction({ ctx: this.agentContext, proposalId: pendingActionId });
      if (!outcome.ok) return { layer: "cartao", text: outcome.error };
      // Plano com parte destrutiva: o cartão dela chega junto do relatório.
      const followUp = outcome.payload.followUp;
      return {
        layer: "cartao",
        text: followUp ? `${outcome.payload.summary}\n${followUp.title}` : outcome.payload.summary,
        confirmationLines: outcome.payload.lines,
        isConfirmationCard: Boolean(followUp),
        pendingActionId: followUp?.proposalId,
      };
    }

    if (!isAwaitingAnswer(this.sessionId)) {
      const typed = await decideLatestCardByText({ ctx: this.agentContext, text });
      if (typed && "cancelledSummary" in typed) return { layer: "cartao", text: typed.cancelledSummary };
      if (typed) return { layer: "cartao", text: typed.ok ? typed.payload.summary : typed.error };
    }

    if (!lastAssistantAsked(this.messages) && !shouldSkipReading(this.sessionId, text)) {
      const queried = await runAstroQuery({ ctx: this.agentContext, text, history });
      if (queried) {
        clearGuidedSlot(this.sessionId);
        // A tabela vai junto no texto: é nela que moram os nomes listados.
        const tableText = queried.result.table ? `\n${JSON.stringify(queried.result.table)}` : "";
        return {
          layer: "consulta",
          key: queried.key,
          text: `${queried.result.text}${tableText}`,
          historyText: queried.result.text,
        };
      }
    }

    const guided = await resolveGuided({
      ctx: this.agentContext,
      text,
      history,
      sessionId: this.sessionId,
    });
    if (guided?.kind === "choice") {
      return {
        layer: "escolha",
        key: guided.actionKey,
        text: guided.payload.description,
        actionResult: guided.payload,
      };
    }
    if (guided?.kind === "result") {
      if (isConfirmation(guided.output)) {
        const cardLines = guided.output.lines.map((line) => `${line.label}: ${line.value}`);
        return {
          layer: "guiado",
          key: guided.action.key,
          text: [guided.output.title, ...cardLines].join("\n"),
          historyText: guided.output.title,
          confirmationLines: guided.output.lines,
          isConfirmationCard: true,
          pendingActionId: guided.output.proposalId,
        };
      }
      return {
        layer: "guiado",
        key: guided.action.key,
        text: guided.output.description,
        actionResult: guided.output,
      };
    }

    const stream = await streamAstro({ ctx: this.agentContext, uiMessages: this.messages });
    const [replyText, steps] = await Promise.all([stream.text, stream.steps]);
    return {
      layer: "orquestrador",
      text: replyText,
      toolNames: steps.flatMap((step) => step.toolCalls.map((call) => call.toolName)),
    };
  }
}
