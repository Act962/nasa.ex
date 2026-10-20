import { transcribePendingLeadAudio } from "./audio-transcription";
import { MAX_AGENT_REPLIES_PER_HOUR } from "./capabilities";
import { canBeSpoken, estimateSpokenSeconds, toSpeakableText } from "@/features/astro-bot/lib/voice/speakable-text";
import { synthesizeSpeech } from "@/features/astro-bot/lib/voice/synthesize-speech";
import { chargeSpeech } from "@/features/astro-bot/lib/voice/reply-voice";
import { TrackingProviderBotChannel } from "@/features/astro-bot/lib/tracking-provider-channel";
import "server-only";
import { generateText, type ModelMessage } from "ai";
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
import { loadAgentContext, type AgentEventData, type AgentTrigger } from "./context";
import { isAttendanceStateEnabled } from "@/features/org-defaults/lib/attendance/flag";
import { markAiReplied } from "@/features/org-defaults/lib/attendance/state";
import { findActiveCampaign } from "@/features/star-friends/lib/campaign/campaign";
import {
  NOTES_INSTRUCTION,
  planSectionNotes,
  saveSectionNotes,
  splitNotesFromReply,
} from "@/features/org-defaults/lib/attendance/section-notes";
import { resolveModel } from "./model";
import { buildSystemPrompt, describeUpcomingAppointments } from "./system-prompt";
import { loadAttendanceKnowledgeBlock } from "./attendance-knowledge";
import { signalLeadAwaitingHuman, type AwaitingHumanReason } from "./awaiting-human";
import { handleGuidedMenu } from "./guided-menu/guided-menu";
import { handleScriptMenu } from "./script-menu";
import { isReplyForWaitingFlow } from "./flow-awaiting-reply";
import { isTopicMenuName } from "./topic-menu";
import { handleTopicMenu } from "./topic-menu-handler";
import { handleCampaign } from "./campaign-handler";
import { handleStoreInfo } from "./store-info-handler";
import { MENU_PRESET_NAME } from "./attendance-setup/script-draft";
import { joinAsSingleMessage, splitForWhatsapp } from "./split-message";
import { persistOutboundMessage } from "./persist";
import { buildAgentTools } from "../server/tools";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { buildCatalogOrderPrompt, PRODUCT_CHECK_PROMPT } from "@/features/nerp-catalog/lib/order-context";
import { deliverTextToLead } from "@/features/nerp-catalog/lib/order-channel";

const RECENT_CLIENT_MESSAGES = 3;
/** Teto do WhatsApp é 4.096; folga para não estourar com emojis. */
const CATALOG_ORDER_MESSAGE_MAX_LEN = 3500;

/** O que o cliente escreveu por último, para escolher o recorte do roteiro sem chamar modelo. */
function recentClientText(history: { role: string; content: unknown }[]): string {
  return history
    .filter((message) => message.role === "user")
    .slice(-RECENT_CLIENT_MESSAGES)
    .map((message) => {
      if (typeof message.content === "string") return message.content;
      if (!Array.isArray(message.content)) return "";
      return message.content.map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text: unknown }).text) : "")).join(" ");
    })
    .join(" ");
}

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

// Quando o estado de atendimento chama a IA (spec 0113): o motivo muda o tom da primeira resposta.
const ATTENDANCE_TRIGGER_INSTRUCTIONS: Partial<Record<AgentTrigger, string>> = {
  "attendance-step-in":
    "O cliente esperou alguns minutos sem resposta da equipe. Peça desculpa pela demora numa frase curta e já ajude no que ele pediu. Se ele reclamou, reconheça sem se justificar.",
  "attendance-in-service":
    "Um atendente estava conversando com o cliente mas não respondeu a tempo. Continue a conversa de onde parou, como se fosse da mesma equipe, sem dizer que é outra pessoa.",
  "attendance-handoff-resume":
    "O cliente pediu um atendente e ninguém da equipe pôde assumir ainda. Diga que a equipe já foi avisada e ajude no que for possível enquanto isso.",
};

const ATTENDANCE_TONE =
  "Responda curto, simples e natural, chamando o cliente pelo primeiro nome. Nada de explicações longas nem frases de robô.";

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

const HISTORY_WITH_SUMMARY_LIMIT = 10;

/** Com o resumo da seção no prompt, bastam as últimas mensagens; começa sempre por uma do cliente. */
function trimHistoryWithSummary(history: ModelMessage[]): ModelMessage[] {
  const recent = history.slice(-HISTORY_WITH_SUMMARY_LIMIT);
  const firstClientIndex = recent.findIndex((message) => message.role === "user");
  return firstClientIndex > 0 ? recent.slice(firstClientIndex) : recent;
}

export async function runWhatsappAgent({ step, data }: RunArgs) {
  // Uma foto só do estado da IA no lead, de a mensagem ser clique em menu e de haver campanha ativa (spec
  // 0113, RF-3). Com a IA pausada só o clique e a campanha seguem, porque disparam fluxo; o resto para aqui,
  // antes de carregar contexto ou transcrever áudio.
  const isInboundTrigger = (data.trigger ?? "inbound") === "inbound";
  const entryGate = await step.run("check-lead-ai", async () => {
    const lead = await prisma.lead.findUnique({ where: { id: data.leadId }, select: { isActive: true } });
    const isActive = lead?.isActive ?? false;
    if (isActive || !data.messageId) return { isActive, isMenuClick: false, hasActiveCampaign: false };
    const inbound = await prisma.message.findFirst({
      where: { id: data.messageId, conversationId: data.conversationId, fromMe: false },
      select: { metadata: true },
    });
    const replyId = (inbound?.metadata as { interactiveReplyId?: unknown } | null)?.interactiveReplyId;
    const activeCampaign = await findActiveCampaign(data.organizationId, data.trackingId);
    return { isActive, isMenuClick: typeof replyId === "string", hasActiveCampaign: Boolean(activeCampaign) };
  });
  const isPausedRuleTrigger = isInboundTrigger && (entryGate.isMenuClick || entryGate.hasActiveCampaign);
  if (!entryGate.isActive && !isPausedRuleTrigger) {
    return { skipped: true, reason: "lead_inactive" };
  }
  const isLeadAiActive = entryGate.isActive;
  // Não envolvemos load-context em step.run: o serializador do Inngest
  // converte o retorno em JsonifyObject, o que quebra o tipo de ModelMessage[]
  // (e o AgentContext que é passado pras tools). Re-executar em retry é barato.
  // Áudio do cliente vira texto antes de montar o histórico (spec 0084, RF-1).
  if (isLeadAiActive) {
    await step.run("transcribe-lead-audio", () =>
      transcribePendingLeadAudio({
        trackingId: data.trackingId,
        conversationId: data.conversationId,
        organizationId: data.organizationId,
      }),
    );
  }
  const ctx = await loadAgentContext(data);
  // Resposta pronta (menu, campanha, informações da loja) também é a empresa respondendo: a seção registra,
  // para o cliente não seguir "Aguard. atendimento" enquanto o robô conversa (spec 0113, RF-9).
  const markCodedReply = async () => {
    if (!isAttendanceStateEnabled(ctx.organizationId)) return;
    await step.run("mark-coded-reply", () => markAiReplied({ leadId: ctx.lead.id, at: new Date() }));
  };

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
    isActive: isLeadAiActive,
    statusFlow: ctx.lead.statusFlow as string,
    repliesLastHour: await prisma.aiChatRun.count({
      where: { leadId: ctx.lead.id, trackingId: ctx.trackingId, createdAt: { gte: new Date(Date.now() - 60 * 60_000) } },
    }),
  }));
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

  // Passo de fluxo esperando a resposta do cliente (spec 0099): a mensagem é do fluxo, ninguém mais responde.
  if ((leadGate.isActive || entryGate.isMenuClick) && data.messageId && (ctx.trigger ?? "inbound") === "inbound") {
    const isForWaitingFlow = await step.run("flow-awaiting-reply", () => isReplyForWaitingFlow(ctx, data.messageId));
    if (isForWaitingFlow) return { skipped: true, reason: "flow_awaiting_reply" };
  }

  // Campanha de sorteio e informações da loja (spec 0102): regras fixas, sem modelo. Vem antes dos
  // menus porque a foto do cupom e o número digitado são respostas a uma pergunta da campanha.
  if (data.messageId && (ctx.trigger ?? "inbound") === "inbound") {
    const campaign = await step.run("star-friends-campaign", () => handleCampaign(ctx, data.messageId));
    if (campaign.handled) {
      await markCodedReply();
      return { skipped: true, reason: "star_friends_campaign" };
    }
  }
  // IA pausada e sem clique: só a campanha valia. Menus e assistente ficam para quando a IA pode falar.
  if (!leadGate.isActive && !entryGate.isMenuClick) return { skipped: true, reason: "lead_inactive" };

  if (leadGate.isActive && data.messageId && (ctx.trigger ?? "inbound") === "inbound") {
    const storeInfo = await step.run("store-info", () => handleStoreInfo(ctx, data.messageId));
    if (storeInfo.handled) {
      await markCodedReply();
      return { skipped: true, reason: "store_info" };
    }
  }

  // Menu de botões (spec 0089): saudação e cliques do menu são resolvidos em código, sem modelo,
  // sem cobrar resposta de IA e sem contar no limite abaixo. O resto segue para a assistente.
  if (ctx.capabilities.guidedMenu && data.messageId && (ctx.trigger ?? "inbound") === "inbound") {
    const guided = await step.run("guided-menu", () => handleGuidedMenu(ctx, data.messageId));
    if (guided.handled) {
      await markCodedReply();
      return { skipped: true, reason: "guided_menu" };
    }
  }

  // Pergunta do menu de um assunto (spec 0096): a resposta do roteiro sai pelo código, sem modelo.
  if (data.messageId && (ctx.trigger ?? "inbound") === "inbound") {
    const topicMenu = await step.run("topic-menu", () => handleTopicMenu(ctx, data.messageId));
    if (topicMenu.handled) {
      await markCodedReply();
      return { skipped: true, reason: "topic_menu" };
    }
  }

  // Menu inicial do roteiro (spec 0091): no começo da conversa, saudação e menu saem pelo código.
  if (data.messageId && (ctx.trigger ?? "inbound") === "inbound") {
    const scriptMenu = await step.run("script-menu", () => handleScriptMenu(ctx, data.messageId));
    if (scriptMenu.handled) {
      await markCodedReply();
      return { skipped: true, reason: "script_menu" };
    }
  }

  // Daqui para baixo é a assistente respondendo: só com a IA ativa no lead. As regras acima são de
  // Gatilho e campanha e valem com a IA pausada (spec 0113, RF-3).
  if (!leadGate.isActive) return { skipped: true, reason: "lead_inactive" };

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

  // O menu inicial do roteiro é enviado pelo código (script-menu). A assistente não o vê: no teste real
  // ela reenviou a saudação com o menu no meio da conversa, quando o cliente só pediu para agendar.
  // Os menus de perguntas por assunto (spec 0096) também: quem os envia é o fluxo e o código.
  const assistantCtx = { ...ctx, availableButtonPresets: ctx.availableButtonPresets.filter((preset) => preset.name !== MENU_PRESET_NAME && !isTopicMenuName(preset.name)) };

  const baseSystem = buildSystemPrompt({
    settings: ctx.settings!,
    orgName: ctx.organization.name,
    leadName: ctx.lead.name,
    hasLeadEmail: Boolean(ctx.lead.email?.trim()),
    currentTags: ctx.lead.leadTags,
    availableTags: ctx.availableTags,
    availableButtonPresets: assistantCtx.availableButtonPresets,
    availableAgendas: ctx.availableAgendas,
    upcomingAppointments: ctx.upcomingAppointments,
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
      // Só o assunto em pauta: o roteiro inteiro a cada resposta era o maior custo por mensagem.
      focus: { tagNames: ctx.lead.leadTags.map((leadTag) => leadTag.tag.name), recentText: recentClientText(ctx.history) },
    }),
  );
  const baseWithKnowledge = knowledgeBlock ? `${baseSystem}\n\n${knowledgeBlock}` : baseSystem;
  const baseWithCatalog = ctx.catalogOrder
    ? `${baseWithKnowledge}\n\n${buildCatalogOrderPrompt(ctx.catalogOrder)}`
    : baseWithKnowledge;
  const baseWithOrder = ctx.hasProductCheck ? `${baseWithCatalog}\n\n${PRODUCT_CHECK_PROMPT}` : baseWithCatalog;
  const attendanceInstruction = ctx.trigger ? ATTENDANCE_TRIGGER_INSTRUCTIONS[ctx.trigger] : undefined;
  const systemPrompt =
    ctx.trigger === "idle-reopen-with-instruction"
      ? `${baseWithOrder}\n\n# Reabertura automática\n\nO lead está ocioso${
          ctx.idleMinutes ? ` há cerca de ${ctx.idleMinutes} minutos` : ""
        } desde a última interação. Não chegou nenhuma nova mensagem do lead. Reabra a conversa de forma natural e curta pra reengajar — referência o contexto anterior se fizer sentido. Evite parecer automático.`
      : attendanceInstruction
        ? `${baseWithOrder}\n\n# Momento do atendimento\n\n${attendanceInstruction}\n\n${ATTENDANCE_TONE}`
        : baseWithOrder;

  // Anotações da seção (spec 0113, RF-14/15): contexto curto do atendimento e, quando é hora, o pedido de
  // resumo no fim da própria resposta, sem chamada extra.
  const sectionNotesPlan = isAttendanceStateEnabled(ctx.organizationId)
    ? await step.run("plan-section-notes", () =>
        planSectionNotes({
          leadId: ctx.lead.id,
          isAttendanceTrigger: Boolean(ctx.trigger && ATTENDANCE_TRIGGER_INSTRUCTIONS[ctx.trigger]),
        }),
      )
    : null;
  const resolved = resolveModel(ctx.modelConfig);
  console.log(
    `[tracking-chat-ai] tracking=${ctx.trackingId} provider=${resolved.provider} model=${resolved.modelId} custom=${resolved.usingCustom}`,
  );

  // Fatos e pedidos que o modelo tem de seguir vão também depois do histórico: no meio do prompt de sistema ele
  // seguia a conversa (respostas gravadas sem notas, "já está marcado" sem agendamento). A Anthropic recusa
  // instrução de sistema no meio da conversa, então lá eles ficam só no prompt de sistema.
  const canInstructAfterHistory = resolved.provider !== "ANTHROPIC";
  const shouldWriteNotes = Boolean(sectionNotesPlan?.shouldWriteNotes);
  const isNotesAfterHistory = shouldWriteNotes && canInstructAfterHistory;
  const trailingInstruction = canInstructAfterHistory
    ? [
        ctx.availableAgendas.length > 0 ? describeUpcomingAppointments(ctx.upcomingAppointments) : "",
        isNotesAfterHistory ? NOTES_INSTRUCTION : "",
      ]
        .filter(Boolean)
        .join("\n\n")
    : "";
  const systemPromptWithNotes = [
    systemPrompt,
    // Tom de toda resposta no estado de atendimento (spec 0113, RF-21); nas entradas pelo atendimento já vai acima.
    // Fora do pedido do catálogo, que precisa listar itens e valores por inteiro.
    sectionNotesPlan && !attendanceInstruction && !ctx.catalogOrder ? ATTENDANCE_TONE : "",
    sectionNotesPlan?.contextBlock,
    shouldWriteNotes && !isNotesAfterHistory ? NOTES_INSTRUCTION : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const agentHistory = sectionNotesPlan?.hasOpenSummary ? trimHistoryWithSummary(ctx.history) : ctx.history;
  const agentMessages: ModelMessage[] = trailingInstruction
    ? [...agentHistory, { role: "system", content: trailingInstruction }]
    : agentHistory;

  const aiResult = await step.run("run-agent", async () => {
    const result = await generateText({
      model: resolved.model,
      system: systemPromptWithNotes,
      tools: buildAgentTools(assistantCtx),
      messages: agentMessages,
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
    // O bloco <notas> nunca vai ao cliente.
    const { replyText, notes } = splitNotesFromReply(result.text);
    return {
      sectionNotes: notes,
      // Transferiu e não escreveu nada: o cliente não pode ficar sem saber que alguém vai continuar.
      text:
        replyText.trim() ||
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
      // Pedido do catálogo em andamento: uma mensagem só, sempre (picotada, a venda guiada vira rajada de
      // mensagens), e sem o corte de 700 caracteres, para uma lista de itens não chegar pela metade.
      const parts = ctx.catalogOrder
        ? joinAsSingleMessage(aiResult.text, CATALOG_ORDER_MESSAGE_MAX_LEN)
        : ctx.capabilities.singleMessageReply
          ? joinAsSingleMessage(aiResult.text)
          : splitForWhatsapp(aiResult.text);
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

  const sectionId = sectionNotesPlan?.sectionId;
  const sectionNotes = aiResult.sectionNotes;
  if (sectionId && sectionNotes && sectionNotesPlan?.shouldWriteNotes) {
    await step.run("save-section-notes", () =>
      saveSectionNotes({ sectionId, notes: sectionNotes, summaryCount: sectionNotesPlan?.summaryCount ?? 0 }),
    );
  }
  // A resposta da IA conta como fala da empresa na seção (troca de verdade, spec 0113 RF-9).
  if (aiResult.text && sectionNotesPlan) {
    await step.run("mark-ai-replied", () => markAiReplied({ leadId: ctx.lead.id, at: new Date() }));
  }

  return {
    ok: true,
    sentText: !!aiResult.text,
    toolCalls: aiResult.toolCalls,
  };
}
