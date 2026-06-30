/**
 * Router principal do Astro Bot via WhatsApp (Insights pelo WhatsApp).
 *
 * Pipeline pra cada mensagem recebida:
 *   1. Identifica binding pelo phoneE164 (allow-list) — feito no webhook-handler
 *   2. Verifica binding ativo, rate limit + quiet hours
 *   3. Chama Astro orchestrator em modo INSIGHTS (read-only)
 *   4. Converte saída pra WhatsApp-friendly
 *   5. Loga em WhatsappBotCommand pra audit + telemetria
 *
 * Sem PIN/sessão: o fluxo confia no número allow-listado pelo admin. Como o
 * escopo é read-only (`toolScope: "insights"`), não há ação destrutiva possível.
 *
 * Cada erro tem reply user-friendly em PT-BR — bot NUNCA mostra stack
 * trace ou JSON cru pro user.
 */
import "server-only";
import type {
  OrganizationBotConfig,
  UserWhatsappBinding,
} from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { streamAstro } from "@/features/astro/server/orchestrator";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { isWithinRateLimit, isWithinQuietHours } from "./rate-limit";
import { loadRecentBotHistory } from "./conversation-history";
import {
  cleanWhatsappReply,
  markdownToWhatsapp,
  summarizeStructuredPayload,
} from "./output-formatter";
import type { BotCommandResult, WhatsappBotChannel } from "./types";

interface RouteContext {
  binding: UserWhatsappBinding;
  botConfig: OrganizationBotConfig;
  channel: WhatsappBotChannel;
  /** uazapi instance deviceId (pra detectar SIM swap). */
  deviceId?: string;
}

export async function handleBotCommand(
  ctx: RouteContext,
  messageText: string,
): Promise<BotCommandResult> {
  const { binding, botConfig } = ctx;

  // ── 1. Binding inativo ─────────────────────────────────────
  if (!binding.isActive) {
    return logAndReturn(binding, messageText, {
      status: "binding_inactive",
      reply:
        "Seu acesso ao Astro Bot foi desativado pelo admin da org. Fale com ele pra reativar.",
    });
  }

  // ── 2. Quiet hours ─────────────────────────────────────────
  if (isWithinQuietHours(botConfig.quietHoursStart, botConfig.quietHoursEnd)) {
    return logAndReturn(binding, messageText, {
      status: "quiet_hours",
      reply: `🌙 Estou em horário de descanso (${botConfig.quietHoursStart}h–${botConfig.quietHoursEnd}h). Te respondo quando voltar.`,
    });
  }

  // ── 3. Rate limit ──────────────────────────────────────────
  const rate = await isWithinRateLimit(binding.id, botConfig.maxCmdsPerHour);
  if (!rate.allowed) {
    return logAndReturn(binding, messageText, {
      status: "rate_limited",
      reply: `⏱️ Você atingiu ${rate.count}/${rate.limit} comandos nesta hora. Aguarde um pouco antes do próximo.`,
    });
  }

  // ── 4. Chama Astro orchestrator em modo INSIGHTS (read-only) ──
  try {
    const agentCtx: AgentContext = {
      userId: binding.userId,
      organizationId: binding.organizationId,
      route: {
        // Bot WhatsApp não tem rota — passa snapshot vazio. Tools que
        // dependem de leadId/conversationId precisarão extrair do texto
        // via search_entities (já existe no orchestrator).
      } as never,
    };

    // Histórico curto por número — dá memória conversacional ("qual o nome
    // desse lead?" depois de "quantos leads tenho?"). Os turnos anteriores
    // entram antes da mensagem atual.
    const history = await loadRecentBotHistory(binding.id);

    const stream = await streamAstro({
      ctx: agentCtx,
      toolScope: "insights",
      // gpt-4o-mini hesita/alucina em list_* pelo WhatsApp — força o gpt-4o.
      forceComplexModel: true,
      outputStyle: "whatsapp",
      uiMessages: [
        ...history,
        {
          id: "bot-cmd",
          role: "user",
          parts: [{ type: "text", text: messageText }],
        } as never,
      ],
    });

    const finalText = await stream.text;
    const usage = await stream.usage;

    // `stream.toolCalls` traz só o ÚLTIMO step — as tools rodam em steps
    // anteriores. Agregamos de TODOS os steps pra logar certo e pra resumir
    // os payloads estruturados (astro_table/astro_chart).
    const steps = (await stream.steps) as Array<{
      toolCalls?: Array<{ toolName?: string }>;
      toolResults?: Array<{ toolName?: string; output?: unknown; result?: unknown }>;
    }>;
    const toolNames = steps
      .flatMap((step) => step.toolCalls ?? [])
      .map((call) => call.toolName ?? "?");

    // ── 5. Coleta payloads estruturados pro resumo ─────────────
    // Tools que retornam astro_chart/astro_table viram resumo textual (no
    // WhatsApp não dá pra renderizar a tabela/clicar).
    const structuredSummaries: string[] = [];
    for (const step of steps) {
      for (const toolResult of step.toolResults ?? []) {
        const result = toolResult.output ?? toolResult.result;
        const summary = summarizeStructuredPayload(result);
        if (summary) structuredSummaries.push(summary);
      }
    }

    // Corta firula e — quando há resumo estruturado logo abaixo — a lista que o
    // modelo repetiu em prosa (senão ela aparece duas vezes).
    const formatted = cleanWhatsappReply(markdownToWhatsapp(finalText ?? ""), {
      hasStructured: structuredSummaries.length > 0,
    });
    const reply = [
      formatted || null,
      structuredSummaries.length > 0 ? structuredSummaries.join("\n\n") : null,
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim();

    return logAndReturn(binding, messageText, {
      status: "ok",
      reply: reply || "✅ Feito.",
      toolsCalled: toolNames,
      tokensUsed: usage?.totalTokens ?? undefined,
    });
  } catch (err) {
    console.error("[astro-bot/router] orchestrator failed", err);
    return logAndReturn(binding, messageText, {
      status: "error_orchestrator",
      reply:
        "❌ Tive um problema processando seu comando. Tenta de novo daqui a pouco — se persistir, manda mensagem no NASA pelo computador.",
    });
  }
}

async function logAndReturn(
  binding: UserWhatsappBinding,
  messageText: string,
  result: BotCommandResult,
): Promise<BotCommandResult> {
  try {
    await prisma.whatsappBotCommand.create({
      data: {
        bindingId: binding.id,
        organizationId: binding.organizationId,
        messageText: messageText.slice(0, 2000),
        responseSummary: result.reply.slice(0, 1000),
        status: result.status,
        toolsCalled: result.toolsCalled ?? [],
        tokensUsed: result.tokensUsed ?? null,
        starsCharged: result.starsCharged ?? null,
      },
    });
  } catch (err) {
    console.warn("[astro-bot/router] log command failed", err);
  }
  return result;
}
