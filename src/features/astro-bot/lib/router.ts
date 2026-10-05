/**
 * Router do Astro pelo WhatsApp. Por mensagem: binding ativo → quiet hours →
 * rate limit → mídia elegível → stake de Stars → (download da mídia) →
 * orquestrador → cobrança por tokens → log em WhatsappBotCommand.
 *
 * Escopo (spec 0019): `insights` (só leitura) por padrão; `assistant` quando a
 * org liga `financeEnabled` — escrita financeira sempre via proposta + "sim".
 */
import "server-only";
import { buildPlannerAdjustPrompt, tryPlannerChangesReply } from "@/features/nasa-planner/server/approval-whatsapp";
import type {
  OrganizationBotConfig,
  UserWhatsappBinding,
} from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { streamAstro } from "@/features/astro/server/orchestrator";
import type { AgentContext, AstroAttachmentRef } from "@/features/astro/server/agents/types";
import { isWithinRateLimit, isWithinQuietHours } from "./rate-limit";
import { loadRecentBotHistory } from "./conversation-history";
import {
  cleanWhatsappReply,
  markdownToWhatsapp,
  summarizeStructuredPayload,
} from "./output-formatter";
import { assessBotInboundMedia, storeBotInboundDocument } from "./inbound-media";
import { chargeBotPromptStake, debitBotTokenUsage } from "./stars-billing";
import { tryCheapLayers } from "./cheap-layers";
import { transcribeBotAudio, type AudioDownloader } from "./audio-transcription";
import type { BotCommandResult, BotInboundMedia, WhatsappBotChannel } from "./types";

interface RouteContext {
  binding: UserWhatsappBinding;
  botConfig: OrganizationBotConfig;
  channel: WhatsappBotChannel;
  /** Tracking que recebeu a mensagem — de onde a mídia é baixada. */
  trackingId: string;
  /** uazapi instance deviceId (pra detectar SIM swap). */
  deviceId?: string;
  media?: BotInboundMedia;
  /** Troca o download do áudio (bateria de QA); padrão: provider do funil. */
  downloadAudio?: AudioDownloader;
}

const INSIGHTS_FALLBACK_REPLY =
  "Não consegui montar uma resposta pra isso 🤔 Eu respondo só com base nos dados desta empresa (leads, conversões, agenda, listas). Tenta reformular ou me diz qual indicador você quer.";
const ASSISTANT_FALLBACK_REPLY =
  "Não consegui montar uma resposta pra isso 🤔 Posso consultar os dados desta empresa, o financeiro (contas a pagar e receber, fluxo de caixa, DRE) e ler boleto ou nota fiscal em PDF/foto. Tenta reformular.";
const STARS_INSUFFICIENT_REPLY =
  "⭐ Sua empresa está sem saldo de Stars pra usar o Astro. Peça ao admin pra recarregar no ÓRBITA e tente de novo.";
const DEFAULT_MEDIA_PROMPT =
  "Leia o documento que acabei de enviar e me mostre o resumo.";

type StepSnapshot = {
  toolCalls?: Array<{ toolName?: string }>;
  toolResults?: Array<{ toolName?: string; output?: unknown; result?: unknown }>;
};

function buildLoggedMessageText(messageText: string, media?: BotInboundMedia): string {
  if (!media) return messageText;
  const mediaLabel = `[${media.kind === "image" ? "foto" : "documento"}${media.fileName ? `: ${media.fileName}` : ""}]`;
  return messageText ? `${mediaLabel} ${messageText}` : mediaLabel;
}

/** O histórico do bot vem como UIMessage; a triagem lê linhas de texto. */
function historyToLines(history: unknown[]): string[] {
  return history
    .map((message) => {
      const entry = message as {
        role?: string;
        parts?: Array<{ type?: string; text?: string }>;
      };
      const text = (entry.parts ?? [])
        .filter((part) => part.type === "text")
        .map((part) => part.text ?? "")
        .join(" ")
        .trim();
      if (!text) return "";
      return `${entry.role === "user" ? "Usuário" : "Astro"}: ${text}`;
    })
    .filter(Boolean);
}

export async function handleBotCommand(
  ctx: RouteContext,
  messageText: string,
): Promise<BotCommandResult> {
  const { binding, botConfig } = ctx;
  // Áudio vira texto depois do stake (spec 0036); daqui em diante, "mídia" é
  // só documento ou imagem.
  const audio = ctx.media?.kind === "audio" ? ctx.media : undefined;
  const media = audio ? undefined : ctx.media;
  let loggedText = audio ? "[áudio]" : buildLoggedMessageText(messageText, media);

  if (!binding.isActive) {
    return logAndReturn(binding, loggedText, {
      status: "binding_inactive",
      reply:
        "Seu acesso ao Astro Bot foi desativado pelo admin da org. Fale com ele pra reativar.",
    });
  }

  if (isWithinQuietHours(botConfig.quietHoursStart, botConfig.quietHoursEnd)) {
    return logAndReturn(binding, loggedText, {
      status: "quiet_hours",
      reply: `🌙 Estou em horário de descanso (${botConfig.quietHoursStart}h–${botConfig.quietHoursEnd}h). Te respondo quando voltar.`,
    });
  }

  const rate = await isWithinRateLimit(binding.id, botConfig.maxCmdsPerHour);
  if (!rate.allowed) {
    return logAndReturn(binding, loggedText, {
      status: "rate_limited",
      reply: `⏱️ Você atingiu ${rate.count}/${rate.limit} comandos nesta hora. Aguarde um pouco antes do próximo.`,
    });
  }

  // Validação barata antes do stake: arquivo recusado não gasta Stars.
  if (media) {
    const assessment = await assessBotInboundMedia(binding, media);
    if (!assessment.isEligible) {
      return logAndReturn(binding, loggedText, {
        status: assessment.status,
        reply: assessment.reply,
      });
    }
  }

  const stake = await chargeBotPromptStake(binding);
  if (!stake.hasBalance) {
    return logAndReturn(binding, loggedText, {
      status: "stars_insufficient",
      reply: STARS_INSUFFICIENT_REPLY,
      starsCharged: 0,
    });
  }

  if (audio) {
    const transcription = await transcribeBotAudio({
      binding,
      trackingId: ctx.trackingId,
      media: audio,
      isBillingExempt: stake.isExempt,
      downloadAudio: ctx.downloadAudio,
    });
    if (!transcription.isTranscribed) {
      return logAndReturn(binding, loggedText, {
        status: "media_failed",
        reply: transcription.reply,
        starsCharged: stake.starsCharged,
      });
    }
    messageText = transcription.text;
    loggedText = `[áudio] ${transcription.text}`;
    stake.starsCharged += transcription.starsCharged;
  }

  let attachments: AstroAttachmentRef[] | undefined;
  if (media) {
    try {
      const stored = await storeBotInboundDocument({
        binding,
        trackingId: ctx.trackingId,
        media,
      });
      if (!stored.isStored) {
        return logAndReturn(binding, loggedText, {
          status: stored.status,
          reply: stored.reply,
          starsCharged: stake.starsCharged,
        });
      }
      attachments = [stored.attachment];
    } catch (storeError) {
      console.error("[astro-bot/router] store media failed", storeError);
      return logAndReturn(binding, loggedText, {
        status: "media_failed",
        reply: "❌ Não consegui guardar esse arquivo. Tenta mandar de novo daqui a pouco.",
        starsCharged: stake.starsCharged,
      });
    }
  }

  const isFinanceEnabled = botConfig.financeEnabled;

  try {
    const agentCtx: AgentContext = {
      userId: binding.userId,
      organizationId: binding.organizationId,
      // O número responde por UMA tracking — as tools não podem vazar dados de
      // outras orgs do membro (ver resolveTargetOrgs).
      restrictToOrgId: binding.organizationId,
      route: {},
      channel: "WHATSAPP",
      // Estável por número: agrupa as propostas pendentes deste binding.
      sessionId: `whatsapp:${binding.id}`,
      attachments,
    };

    const history = await loadRecentBotHistory(binding.id);
    const promptText = messageText.trim() || DEFAULT_MEDIA_PROMPT;

    // Antes do orquestrador, as mesmas camadas baratas do widget. "Quantos
    // leads temos" é `count()`, e os verbos executam em código — pelo
    // WhatsApp isso ia ao modelo caro e voltava "não consegui montar uma
    // resposta". Só vale sem anexo: documento é trabalho de modelo.
    // "AJUSTE: motivo" respondendo a um aviso de aprovação do Planner (spec 0064, RF-5).
    if (!media) {
      const changesReply = await tryPlannerChangesReply({ binding, text: promptText }).catch((error: unknown) => {
        console.warn("[astro-bot/router] ajuste do Planner falhou", error);
        return null;
      });
      if (changesReply) {
        return logAndReturn(binding, loggedText, { status: "ok", reply: changesReply, toolsCalled: ["planner.request_changes"], starsCharged: stake.starsCharged });
      }
    }

    if (!media) {
      const cheap = await tryCheapLayers({
        ctx: agentCtx,
        text: promptText,
        history: historyToLines(history),
      });
      if (cheap) {
        const tokenStars = stake.isExempt
          ? 0
          : await debitBotTokenUsage(binding, cheap.tokensUsed);
        console.log(
          `[astro-bot/router] camada ${cheap.route} resolveu${cheap.actionKey ? `: ${cheap.actionKey}` : ""}`,
        );
        return logAndReturn(binding, loggedText, {
          status: "ok",
          reply: cheap.reply,
          buttons: cheap.buttons,
          toolsCalled: [cheap.route],
          tokensUsed: cheap.tokensUsed,
          starsCharged: stake.starsCharged + tokenStars,
        });
      }
    }

    const plannerAdjustPrompt = media ? null : await buildPlannerAdjustPrompt({ binding, text: promptText }).catch(() => null);
    const orchestratorPrompt = plannerAdjustPrompt ?? promptText;

    const stream = await streamAstro({
      ctx: agentCtx,
      toolScope: isFinanceEnabled ? "assistant" : "insights",
      // gpt-4o-mini hesita/alucina em list_* pelo WhatsApp — força o gpt-4o.
      forceComplexModel: true,
      outputStyle: "whatsapp",
      uiMessages: [
        ...history,
        {
          id: "bot-cmd",
          role: "user",
          parts: [{ type: "text", text: orchestratorPrompt }],
        } as never,
      ],
    });

    const finalText = await stream.text;
    const usage = await stream.usage;
    const tokenStars = stake.isExempt
      ? 0
      : await debitBotTokenUsage(binding, usage?.totalTokens ?? 0);

    // `stream.toolCalls` traz só o último step; as tools rodam nos anteriores.
    const steps = (await stream.steps) as StepSnapshot[];
    const toolNames = steps
      .flatMap((step) => step.toolCalls ?? [])
      .map((call) => call.toolName ?? "?");

    const structuredSummaries: string[] = [];
    for (const step of steps) {
      for (const toolResult of step.toolResults ?? []) {
        const summary = summarizeStructuredPayload(toolResult.output ?? toolResult.result);
        if (summary) structuredSummaries.push(summary);
      }
    }

    const formattedReply = cleanWhatsappReply(markdownToWhatsapp(finalText ?? ""), {
      hasStructured: structuredSummaries.length > 0,
    });
    // O cartão de confirmação já traz o "Responda SIM…"; o modelo às vezes repete a instrução antes dele.
    const hasConfirmationCard = structuredSummaries.some((summary) => /Responda \*SIM\*/.test(summary));
    // Texto imitando cartão sem a tool ter criado um: o SIM confirmaria outra coisa. Nunca envia.
    const isImitatedCard = !hasConfirmationCard && /responda\s+[_*]?sim|confira e confirme|confira o cart[aã]o|\[cart[aã]o/i.test(formattedReply);
    if (isImitatedCard) {
      console.warn("[astro-bot/router] resposta imitou cartão sem proposta — descartada");
    }
    const formatted = isImitatedCard
      ? "Não consegui preparar o cartão desta vez. Pode repetir o pedido?"
      : hasConfirmationCard
      ? formattedReply
          .split("\n")
          .filter((line) => !/responda\s+[_*]?sim/i.test(line))
          .join("\n")
          .trim()
      : formattedReply;
    const reply = [
      formatted || null,
      structuredSummaries.length > 0 ? structuredSummaries.join("\n\n") : null,
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim();

    // Reply vazio nunca vira "✅ Feito." — confirmação falsa confunde o usuário.
    return logAndReturn(binding, loggedText, {
      status: reply ? "ok" : "empty_reply",
      reply: reply || (isFinanceEnabled ? ASSISTANT_FALLBACK_REPLY : INSIGHTS_FALLBACK_REPLY),
      toolsCalled: toolNames,
      tokensUsed: usage?.totalTokens ?? undefined,
      starsCharged: stake.starsCharged + tokenStars,
    });
  } catch (orchestratorError) {
    console.error("[astro-bot/router] orchestrator failed", orchestratorError);
    return logAndReturn(binding, loggedText, {
      status: "error_orchestrator",
      reply:
        "❌ Tive um problema processando seu comando. Tenta de novo daqui a pouco — se persistir, manda mensagem no ÓRBITA pelo computador.",
      starsCharged: stake.starsCharged,
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
  } catch (logError) {
    console.warn("[astro-bot/router] log command failed", logError);
  }
  return result;
}
