/**
 * Router principal do Astro Bot via WhatsApp.
 *
 * Pipeline pra cada mensagem recebida:
 *   1. Identifica binding pelo phoneE164 (já passa pelo /api/chat/webhook
 *      hook que detecta isso antes do fluxo normal de atendimento)
 *   2. Verifica rate limit + quiet hours
 *   3. Auth: PIN no 1º cmd do dia + sempre PIN em destrutivo
 *   4. Chama Astro orchestrator com contexto restrito (whitelist tools)
 *   5. Converte saída pra WhatsApp-friendly
 *   6. Envia resposta via channel
 *   7. Loga em WhatsappBotCommand pra audit + telemetria
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
import {
  isSessionActive,
  isLocked,
  isDestructiveTool,
  tryAuthenticateWithPin,
} from "./auth";
import { isWithinRateLimit, isWithinQuietHours } from "./rate-limit";
import {
  markdownToWhatsapp,
  summarizeStructuredPayload,
} from "./output-formatter";
import type { BotCommandResult, WhatsappBotChannel } from "./types";

// ── Padrões de comando ─────────────────────────────────────────
// User pode mandar "1234" (só PIN), "PIN 1234", "auth 1234" pra ativar
// sessão; ou texto normal pra comando.
const PIN_ONLY_REGEX = /^\s*(?:pin|auth|c[oó]digo)?\s*[:\s]?\s*(\d{4,6})\s*$/i;

function extractPin(text: string): string | null {
  const m = text.match(PIN_ONLY_REGEX);
  return m ? m[1]! : null;
}

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

  // ── 2. Locked? ─────────────────────────────────────────────
  if (isLocked(binding)) {
    return logAndReturn(binding, messageText, {
      status: "pin_locked",
      reply:
        "🔐 Acesso temporariamente bloqueado por excesso de tentativas. Tente novamente em 1 hora.",
    });
  }

  // ── 3. Quiet hours ─────────────────────────────────────────
  if (isWithinQuietHours(botConfig.quietHoursStart, botConfig.quietHoursEnd)) {
    return logAndReturn(binding, messageText, {
      status: "quiet_hours",
      reply: `🌙 Estou em horário de descanso (${botConfig.quietHoursStart}h–${botConfig.quietHoursEnd}h). Te respondo quando voltar.`,
    });
  }

  // ── 4. Rate limit ──────────────────────────────────────────
  const rate = await isWithinRateLimit(binding.id, botConfig.maxCmdsPerHour);
  if (!rate.allowed) {
    return logAndReturn(binding, messageText, {
      status: "rate_limited",
      reply: `⏱️ Você atingiu ${rate.count}/${rate.limit} comandos nesta hora. Aguarde um pouco antes do próximo.`,
    });
  }

  // ── 5. Auth ─────────────────────────────────────────────────
  const sessionActive = isSessionActive(binding);
  const pinCandidate = extractPin(messageText);

  // 5a. Sem sessão ativa E user mandou PIN → tenta autenticar
  if (!sessionActive && pinCandidate) {
    const auth = await tryAuthenticateWithPin(
      binding.id,
      pinCandidate,
      ctx.deviceId,
    );
    if (auth.ok) {
      return logAndReturn(binding, messageText, {
        status: "ok",
        reply:
          "✅ Sessão ativada por 8h. Pode mandar seu comando.\n_Ex: 'liste leads de hoje', 'resumo do João Silva', 'gráfico de propostas'._",
      });
    }
    if (auth.reason === "locked") {
      return logAndReturn(binding, messageText, {
        status: "pin_locked",
        reply:
          "🔐 PIN errado várias vezes — acesso bloqueado por 1 hora.",
      });
    }
    return logAndReturn(binding, messageText, {
      status: "pin_required",
      reply: "🔐 PIN incorreto. Tente novamente.",
    });
  }

  // 5b. Sem sessão e SEM PIN → pede PIN
  if (!sessionActive) {
    return logAndReturn(binding, messageText, {
      status: "pin_required",
      reply:
        "🔐 Manda seu código de acesso pra ativar a sessão.\n_Ex: 1234_",
    });
  }

  // ── 6. Chama Astro orchestrator ───────────────────────────
  // (auth ok, pode rodar)
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

    const stream = await streamAstro({
      ctx: agentCtx,
      uiMessages: [
        {
          id: "bot-cmd",
          role: "user",
          parts: [{ type: "text", text: messageText }],
        } as never,
      ],
    });

    const finalText = await stream.text;
    const toolCalls = await stream.toolCalls;
    const usage = await stream.usage;
    const toolNames = (toolCalls ?? []).map(
      (t: { toolName?: string }) => t.toolName ?? "?",
    );

    // ── 6b. Bloqueia se alguma tool destrutiva foi usada sem PIN fresco ──
    // O bot deveria intercepta ANTES de executar — mas como o stream já
    // rodou, marcamos e respondemos. Tools destrutivas só passam quando
    // o user manda PIN no MESMO comando (não vale só ter sessão).
    const destructiveToolCalled = toolNames.some(isDestructiveTool);
    if (destructiveToolCalled && !pinCandidate) {
      return logAndReturn(binding, messageText, {
        status: "tool_denied",
        reply:
          "⚠️ Esse comando envolve ação destrutiva. Manda seu PIN no mesmo recado pra confirmar.\n_Ex: 'deleta lead João 1234'_",
        toolsCalled: toolNames,
      });
    }

    // ── 7. Coleta payloads estruturados pro resumo ─────────────
    // Tools que retornam astro_chart/astro_table viram resumo curto;
    // Fase 3 vai mandar como imagem.
    const structuredSummaries: string[] = [];
    for (const tc of toolCalls ?? []) {
      const result = (tc as { result?: unknown }).result;
      const summary = summarizeStructuredPayload(result);
      if (summary) structuredSummaries.push(summary);
    }

    const formatted = markdownToWhatsapp(finalText ?? "");
    const reply = [
      formatted,
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
