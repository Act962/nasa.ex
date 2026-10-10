import { transcribePendingLeadAudio } from "./audio-transcription";
import { MAX_AGENT_REPLIES_PER_HOUR } from "./capabilities";
import { canBeSpoken, estimateSpokenSeconds, toSpeakableText } from "@/features/astro-bot/lib/voice/speakable-text";
import { synthesizeSpeech } from "@/features/astro-bot/lib/voice/synthesize-speech";
import { chargeSpeech } from "@/features/astro-bot/lib/voice/reply-voice";
import { TrackingProviderBotChannel } from "@/features/astro-bot/lib/tracking-provider-channel";
import "server-only";
import { generateText } from "ai";
import { reportAiQuotaExhausted } from "@/features/alerts/lib/ai-token-alerts";
import type { GetStepTools } from "inngest";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers";
import {
  isFreeFormWindowOpen,
  toLegacyUazapiMessageId,
  WINDOW_CLOSED_SKIP_REASON,
} from "@/features/tracking-chat/lib/providers/automated-outbound";
import { inngest } from "@/inngest/client";
import { recordUsageEvent } from "@/features/stars/lib/metering";
import prisma from "@/lib/prisma";
import { loadAgentContext, type AgentEventData } from "./context";
import { resolveModel } from "./model";
import { buildSystemPrompt } from "./system-prompt";
import { loadAttendanceKnowledgeBlock } from "./attendance-knowledge";
import { signalLeadAwaitingHuman, type AwaitingHumanReason } from "./awaiting-human";
import { handleGuidedMenu } from "./guided-menu/guided-menu";
import { splitForWhatsapp } from "./split-message";
import { persistOutboundMessage } from "./persist";
import { buildAgentTools } from "../server/tools";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { buildCatalogOrderPrompt } from "@/features/nerp-catalog/lib/order-context";
import { deliverTextToLead } from "@/features/nerp-catalog/lib/order-channel";

type Step = GetStepTools<typeof inngest>;

/** Falha na voz nunca impede o texto: só registra e segue. */
async function sendLeadVoiceReply(params: {
  organizationId: string;
  trackingId: string;
  leadPhone: string;
  text: string;
  voiceName: string | null;
}): Promise<void> {
  if (!canBeSpoken(params.text)) return;
  const speakableText = toSpeakableText(params.text);
  const speech = await synthesizeSpeech({
    text: speakableText,
    voiceName: params.voiceName,
    organizationId: params.organizationId,
  });
  if (!speech) return;
  try {
    await new TrackingProviderBotChannel(params.trackingId).sendVoice(params.leadPhone, {
      audio: speech.audio,
      mimetype: speech.mimetype,
    });
    await chargeSpeech({ organizationId: params.organizationId }, estimateSpokenSeconds(speakableText), speech);
  } catch (voiceError) {
    console.warn(
      "[tracking-chat-ai] nota de voz falhou:",
      voiceError instanceof Error ? voiceError.message.slice(0, 160) : "erro",
    );
  }
}

function signalAwaitingHuman(ctx: Awaited<ReturnType<typeof loadAgentContext>>, reason: AwaitingHumanReason) {
  return signalLeadAwaitingHuman({
    organizationId: ctx.organizationId,
    leadId: ctx.lead.id,
    conversationId: ctx.conversation.id,
    reason,
  });
}

interface RunArgs {
  step: Step;
  data: AgentEventData;
}

const INTER_MESSAGE_DELAY_MS = 600;

/** A janela de 24h já foi conferida no início de `runWhatsappAgent`. */
async function sendAgentText(
  trackingId: string,
  leadPhone: string,
  text: string,
  typingDelayMs: number,
): Promise<string> {
  const resolved = await resolveOutboundProvider(trackingId);
  const sent = await resolved.provider.sendText({
    kind: "text",
    to: leadPhone,
    body: text,
    typingDelayMs,
  });
  return toLegacyUazapiMessageId(sent);
}

/** Aviso automático ao cliente. Fica no histórico: a equipe precisa ver o que foi dito antes de assumir. */
async function sendAgentNotice(
  ctx: Awaited<ReturnType<typeof loadAgentContext>>,
  text: string,
): Promise<void> {
  const externalMessageId = await sendAgentText(ctx.trackingId, ctx.lead.phone!, text, 0);
  await persistOutboundMessage({
    conversationId: ctx.conversation.id,
    leadId: ctx.lead.id,
    trackingId: ctx.trackingId,
    body: text,
    senderName: ctx.settings?.assistantName ?? "IA",
    externalMessageId,
  });
}

export async function runWhatsappAgent({ step, data }: RunArgs) {
  // Não envolvemos load-context em step.run: o serializador do Inngest
  // converte o retorno em JsonifyObject, o que quebra o tipo de ModelMessage[]
  // (e o AgentContext que é passado pras tools). Re-executar em retry é barato.
  // Áudio do cliente vira texto antes de montar o histórico (spec 0084, RF-1).
  await step.run("transcribe-lead-audio", () =>
    transcribePendingLeadAudio({
      trackingId: data.trackingId,
      conversationId: data.conversationId,
      organizationId: data.organizationId,
    }),
  );
  const ctx = await loadAgentContext(data);

  // Pedido do catálogo NERP roda também só no portal (/pedido/<token>), sem
  // instância de WhatsApp no tracking.
  if (!ctx.instance && !ctx.catalogOrder)
    return { skipped: true, reason: "no_whatsapp_instance" };
  if (!ctx.settings) return { skipped: true, reason: "no_ai_settings" };
  // O Inngest roda esta função de novo a cada etapa, e o contexto é recarregado toda vez.
  // O estado do lead e o uso da última hora são fotografados uma vez só, numa etapa: sem isso,
  // quando o próprio agente transferia para um atendente (lead inativo), a rodada seguinte
  // parava aqui e a mensagem de despedida nunca era enviada.
  const leadGate = await step.run("check-lead-gate", async () => ({
    isActive: ctx.lead.isActive,
    statusFlow: ctx.lead.statusFlow as string,
    repliesLastHour: await prisma.aiChatRun.count({
      where: { leadId: ctx.lead.id, trackingId: ctx.trackingId, createdAt: { gte: new Date(Date.now() - 60 * 60_000) } },
    }),
  }));
  if (!leadGate.isActive) return { skipped: true, reason: "lead_inactive" };
  if (leadGate.statusFlow === "FINISHED")
    return { skipped: true, reason: "lead_finished" };
  if (!ctx.lead.phone) return { skipped: true, reason: "lead_no_phone" };
  // Conversa truly vazia (sem msgs, ou só mídias sem texto/caption). O SDK
  // rejeita `messages: []` com `AI_InvalidPromptError`. Próxima inbound
  // reativa o agente naturalmente.
  if (ctx.history.length === 0)
    return { skipped: true, reason: "empty_history" };

  // A IA também é acordada pela automação de inatividade, horas depois da
  // última mensagem do lead. Na API Oficial, fora da janela de 24h a
  // resposta não chegaria: não roda (nem cobra).
  if (ctx.instance && !ctx.catalogOrder) {
    const resolved = await resolveOutboundProvider(ctx.trackingId);
    if (!(await isFreeFormWindowOpen(resolved, ctx.conversation.id))) {
      return { skipped: true, reason: WINDOW_CLOSED_SKIP_REASON };
    }
  }

  // Menu de botões (spec 0089): saudação e cliques do menu são resolvidos em código, sem modelo,
  // sem cobrar resposta de IA e sem contar no limite abaixo. O resto segue para a assistente.
  if (ctx.capabilities.guidedMenu && data.messageId && (ctx.trigger ?? "inbound") === "inbound") {
    const guided = await step.run("guided-menu", () => handleGuidedMenu(ctx, data.messageId));
    if (guided.handled) return { skipped: true, reason: "guided_menu" };
  }

  // Limite por cliente (spec 0084, RS-9): protege o número e o saldo da empresa de uso abusivo.
  // No limite, avisa uma vez e passa para a equipe; acima dele, fica em silêncio.
  const { repliesLastHour } = leadGate;
  if (repliesLastHour >= MAX_AGENT_REPLIES_PER_HOUR) {
    if (repliesLastHour === MAX_AGENT_REPLIES_PER_HOUR && !ctx.catalogOrder) {
      await step.run("send-rate-limit-notice", async () => {
        await sendAgentNotice(ctx, "Vou passar seu atendimento para a nossa equipe, que continua por aqui.");
        await prisma.lead.update({ where: { id: ctx.lead.id }, data: { isActive: false, statusFlow: "ACTIVE" } });
        await signalAwaitingHuman(ctx, "usage_limit");
        // Conta como execução: a próxima mensagem já cai acima do limite e não repete o aviso.
        await prisma.aiChatRun.create({
          data: {
            trackingId: ctx.trackingId,
            organizationId: ctx.organizationId,
            leadId: ctx.lead.id,
            conversationId: ctx.conversation.id,
            modelId: "rate-limit",
            usingCustom: false,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            toolCalls: 0,
          },
        });
      });
    }
    return { skipped: true, reason: "lead_rate_limited" };
  }

  // ── Barramento por STARS ──────────────────────────────────────────────
  // Verifica grace period e suspensão ANTES de gastar tokens com IA. Org
  // suspensa = silêncio total; em grace com saldo 0 = fallback humano.
  const orgState = await prisma.organization.findUnique({
    where: { id: data.organizationId },
    select: {
      starsBalance: true,
      starsBonusBalance: true,
      starsGraceStartedAt: true,
      starsSuspendedAt: true,
    },
  });
  if (orgState?.starsSuspendedAt) {
    return { skipped: true, reason: "stars_suspended" };
  }
  const totalStars =
    (orgState?.starsBalance ?? 0) + (orgState?.starsBonusBalance ?? 0);
  if (orgState?.starsGraceStartedAt && totalStars <= 0) {
    // Conta em grace E sem saldo → não responde IA. Mensagem de fallback
    // pra não deixar o lead "no escuro".
    await step.run("send-grace-fallback", async () => {
      const fallbackText =
        "Estamos com você! Em instantes um atendente humano retornará. Obrigado pela paciência.";
      if (ctx.catalogOrder) {
        await deliverTextToLead({
          conversationId: ctx.conversation.id,
          text: fallbackText,
          senderName: ctx.settings?.assistantName ?? "IA",
        });
        return;
      }
      await sendAgentNotice(ctx, fallbackText);
      await signalAwaitingHuman(ctx, "no_balance");
    });
    return { skipped: true, reason: "stars_grace_no_balance" };
  }

  // Cobrança 2★ por resposta gerada (registry: `chat_ai_message`).
  // Se não tem saldo → não chama LLM (já validamos acima, mas double-check).
  // Dentro de etapa: fora dela a cobrança era refeita a cada rodada da função (uma por etapa),
  // e a mesma resposta era cobrada várias vezes.
  const charge = await step.run("charge-reply", async () => {
    const charged = await chargeStarsByAction(data.organizationId, "chat_ai_message", {
      description: "Resposta IA WhatsApp",
      appSlug: "chat_ai_message",
    });
    return { success: charged.success };
  });
  if (!charge.success) {
    await step.run("send-no-balance-fallback", async () => {
      const fallbackText = "Estamos com você! Em instantes um atendente humano retornará.";
      if (ctx.catalogOrder) {
        await deliverTextToLead({
          conversationId: ctx.conversation.id,
          text: fallbackText,
          senderName: ctx.settings?.assistantName ?? "IA",
        });
        return;
      }
      await sendAgentNotice(ctx, fallbackText);
      await signalAwaitingHuman(ctx, "no_balance");
    });
    return { skipped: true, reason: "stars_insufficient" };
  }

  const baseSystem = buildSystemPrompt({
    settings: ctx.settings!,
    orgName: ctx.organization.name,
    leadName: ctx.lead.name,
    currentTags: ctx.lead.leadTags,
    availableTags: ctx.availableTags,
    availableButtonPresets: ctx.availableButtonPresets,
    availableAgendas: ctx.availableAgendas,
    availableForms: ctx.availableForms,
    capabilities: ctx.capabilities,
  });

  // Apêndice ao system prompt quando o disparo veio da automação de ociosidade
  // com instrução de reabertura: não há nova msg do lead, o agente precisa
  // tomar iniciativa pra reengajar de forma natural.
  const knowledgeBlock = await step.run("load-attendance-knowledge", () =>
    loadAttendanceKnowledgeBlock({
      organizationId: ctx.organizationId,
      knowledgeIds: ctx.capabilities.knowledgeIds,
    }),
  );
  const baseWithKnowledge = knowledgeBlock ? `${baseSystem}\n\n${knowledgeBlock}` : baseSystem;
  const baseWithOrder = ctx.catalogOrder
    ? `${baseWithKnowledge}\n\n${buildCatalogOrderPrompt(ctx.catalogOrder)}`
    : baseWithKnowledge;
  const systemPrompt =
    ctx.trigger === "idle-reopen-with-instruction"
      ? `${baseWithOrder}\n\n# Reabertura automática\n\nO lead está ocioso${
          ctx.idleMinutes ? ` há cerca de ${ctx.idleMinutes} minutos` : ""
        } desde a última interação. Não chegou nenhuma nova mensagem do lead. Reabra a conversa de forma natural e curta pra reengajar — referência o contexto anterior se fizer sentido. Evite parecer automático.`
      : baseWithOrder;

  const resolved = resolveModel(ctx.modelConfig);
  console.log(
    `[tracking-chat-ai] tracking=${ctx.trackingId} provider=${resolved.provider} model=${resolved.modelId} custom=${resolved.usingCustom}`,
  );

  const aiResult = await step.run("run-agent", async () => {
    const result = await generateText({
      model: resolved.model,
      system: systemPrompt,
      tools: buildAgentTools(ctx),
      messages: ctx.history,
      stopWhen: ({ steps }) => steps.length >= 6,
    }).catch(async (error: unknown) => {
      await reportAiQuotaExhausted({
        organizationId: ctx.organizationId,
        usingCustomKey: resolved.usingCustom,
        source: "tracking-chat-ai",
        error,
        // Chave própria daqui é a do AiSettings do tracking, não a de Satélites; a padrão é a OpenAI da plataforma.
        provider: resolved.usingCustom ? undefined : "openai",
      });
      throw error;
    });
    // `result.usage` agrega tokens de todos os steps internos quando há tool
    // calls. Alguns providers omitem campos — coalesce pra 0.
    const inputTokens = result.usage?.inputTokens ?? 0;
    const outputTokens = result.usage?.outputTokens ?? 0;
    const totalTokens =
      result.usage?.totalTokens ?? inputTokens + outputTokens;
    const calledToolNames = result.steps.flatMap((agentStep) => agentStep.toolCalls.map((call) => call.toolName));
    return {
      // Transferiu e não escreveu nada: o cliente não pode ficar sem saber que alguém vai continuar.
      text:
        result.text.trim() ||
        (calledToolNames.includes("transfer_to_human")
          ? "Vou passar seu atendimento para a nossa equipe, que continua por aqui."
          : ""),
      toolCalls: calledToolNames.length,
      inputTokens,
      outputTokens,
      totalTokens,
    };
  });

  // Telemetria: uma linha por execução. Não bloqueia o fluxo se falhar.
  await step.run("persist-usage", async () => {
    try {
      await prisma.aiChatRun.create({
        data: {
          trackingId: ctx.trackingId,
          organizationId: ctx.organizationId,
          leadId: ctx.lead.id,
          conversationId: ctx.conversation.id,
          provider:
            resolved.provider === "NASA_DEFAULT" ? null : resolved.provider,
          modelId: resolved.modelId,
          usingCustom: resolved.usingCustom,
          inputTokens: aiResult.inputTokens,
          outputTokens: aiResult.outputTokens,
          totalTokens: aiResult.totalTokens,
          toolCalls: aiResult.toolCalls,
        },
      });
    } catch (err) {
      console.error("[tracking-chat-ai] persist-usage falhou", err);
    }

    // Custo do evento, separado da telemetria por tracking acima: aquela
    // alimenta uma tela, esta alimenta a apuração de margem.
    await recordUsageEvent({
      organizationId: ctx.organizationId,
      kind: "LLM",
      action: "chat_ai_message",
      appSlug: "nasachat",
      feature: "tracking-chat-ai.agent",
      provider:
        resolved.provider === "NASA_DEFAULT"
          ? undefined
          : resolved.provider.toLowerCase(),
      modelId: resolved.modelId,
      usingCustomKey: resolved.usingCustom,
      tokens: {
        inputTokens: aiResult.inputTokens,
        outputTokens: aiResult.outputTokens,
        totalTokens: aiResult.totalTokens,
      },
      trackingId: ctx.trackingId,
      leadId: ctx.lead.id,
    });
  });

  if (aiResult.text) {
    await step.run("send-final-text", async () => {
      // Cliente mandou áudio e a empresa ligou a voz: nota de voz antes do texto (spec 0084, RF-3).
      // O texto segue sempre, para ficar registrado no atendimento.
      if (ctx.capabilities.voiceReply && ctx.isLastInboundAudio && !ctx.catalogOrder) {
        await sendLeadVoiceReply({
          organizationId: ctx.organizationId,
          trackingId: ctx.trackingId,
          leadPhone: ctx.lead.phone!,
          text: aiResult.text,
          voiceName: ctx.capabilities.voiceName,
        });
      }
      const parts = splitForWhatsapp(aiResult.text);
      for (let i = 0; i < parts.length; i++) {
        const chunk = parts[i];
        if (ctx.catalogOrder) {
          await deliverTextToLead({
            conversationId: ctx.conversation.id,
            text: chunk,
            senderName: ctx.settings?.assistantName ?? "IA",
          });
          continue;
        }
        const externalMessageId = await sendAgentText(
          ctx.trackingId,
          ctx.lead.phone!,
          chunk,
          INTER_MESSAGE_DELAY_MS,
        );
        await persistOutboundMessage({
          conversationId: ctx.conversation.id,
          leadId: ctx.lead.id,
          trackingId: ctx.trackingId,
          body: chunk,
          senderName: ctx.settings?.assistantName ?? "IA",
          externalMessageId,
        });
        if (i < parts.length - 1) {
          await new Promise((r) => setTimeout(r, INTER_MESSAGE_DELAY_MS));
        }
      }
      return { sent: parts.length };
    });
  }

  return {
    ok: true,
    sentText: !!aiResult.text,
    toolCalls: aiResult.toolCalls,
  };
}
