/**
 * Hook chamado no início dos webhooks de WhatsApp (`/api/chat/webhook` Uazapi
 * e `/api/chat/webhook/official` Meta): se o número do remetente está na
 * allow-list (`UserWhatsappBinding`) E a tracking que recebeu a mensagem está
 * habilitada pro Astro, este handler intercepta, roda o Astro Bot e retorna
 * `handled: true` — o webhook NÃO segue pro fluxo de atendimento normal (sem
 * criar Lead/Conversation/Message).
 *
 * Provider-agnóstico: a resposta sai pelo provider ATIVO da própria tracking
 * (Uazapi ou Meta), via `TrackingProviderBotChannel`.
 */
import "server-only";
import type {
  OrganizationBotConfig,
  UserWhatsappBinding,
} from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { waIdLookupVariants } from "@/features/tracking-chat/lib/providers/adapters/meta-cloud/normalize-phone";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers/resolve-outbound-provider";
import { handleBotCommand } from "./router";
import { sendVoiceReply, shouldReplyWithVoice } from "./voice/reply-voice";
import { notifyBotMessageReceived, scheduleInactivityNotice } from "./inactivity";
import { rememberOpenQuestion } from "./open-question";
import { TrackingProviderBotChannel } from "./tracking-provider-channel";
import type { BotInboundMedia } from "./types";

export interface WhatsappWebhookHookInput {
  /** Phone do remetente da mensagem WhatsApp, formato E.164 sem `+`. */
  fromPhone: string;
  /** Texto da mensagem (ou legenda da mídia). Pode vir vazio quando há `media`. */
  messageText: string;
  /**
   * Documento/imagem (spec 0019). Só é interceptado quando a org liga
   * `financeEnabled`; sem isso a mídia segue o atendimento normal.
   */
  media?: BotInboundMedia;
  /** Clique em botão ou lista enviados pelo Astro: o `id` que voltou no webhook (spec 0079). */
  /** Id da mensagem no provider (`wamid`), para ignorar reenvio da mesma entrega. */
  externalMessageId?: string;
  interactiveReplyId?: string;
  /** Id da mensagem que tinha o botão clicado (`context.id` da Meta). */
  interactiveContextId?: string;
  /** Tracking que recebeu o webhook — define o número/provider de resposta. */
  trackingId: string;
  /**
   * Org da tracking que recebeu o webhook. Restringe a interceptação ao
   * binding desta org — evita colisão quando um membro de outra org
   * compartilha o mesmo número WhatsApp de um lead desta tracking.
   */
  trackingOrganizationId: string;
  /** deviceId da uazapi (opcional, só Uazapi tem). */
  deviceId?: string;
}

export interface WhatsappWebhookHookResult {
  /** Quando true, webhook deve PARAR — não cria Lead/Message normal. */
  handled: boolean;
  /** Quando handled, qual binding processou. Pro log. */
  bindingId?: string;
  /** Status do processamento. */
  status?: string;
}

/** Identifica de quem é a mensagem e em qual tracking/org ela caiu. */
export interface BotGateInput {
  /** Phone da contraparte, E.164 sem `+`. No inbound é o remetente; no echo
   * `fromMe:true` é o destinatário — em ambos, o número allow-listado. */
  phone: string;
  trackingId: string;
  trackingOrganizationId: string;
}

type BindingWithConfig = UserWhatsappBinding & {
  botConfig: OrganizationBotConfig;
};

interface BotGateResult {
  /** true quando a mensagem é roteada pro Astro (não pro atendimento). */
  allowed: boolean;
  /** Binding resolvido quando `allowed` — pronto pra rodar o comando. */
  binding?: BindingWithConfig;
}

/**
 * Decide se um número/tracking está coberto pelo Astro Bot. Fonte única de
 * verdade do gating, reutilizada pelo inbound (`maybeHandleBotMessage`) e pela
 * supressão do echo do Uazapi (`shouldSuppressBotEcho`). Mantê-los no mesmo
 * gate garante que o echo da resposta do bot é suprimido exatamente nos casos
 * em que o inbound foi interceptado.
 */
export async function resolveBotGate(input: BotGateInput): Promise<BotGateResult> {
  // 1 e 2. Binding do número NESTA org — a org dona do botConfig é a fonte autoritativa.
  // O mesmo telefone pode existir em outra org, e em duas grafias: a Meta entrega o número de
  // conta móvel antiga sem o 9º dígito (`558698221810`) e o admin cadastra com ele
  // (`5586998221810`). Igualdade exata deixava o Astro mudo na API oficial; buscar sem filtrar a
  // org achava o binding da outra grafia, de outra empresa. Sem binding aqui, a mensagem é de um
  // lead desta tracking que por acaso compartilha o número com um membro de outra org.
  const binding = await prisma.userWhatsappBinding.findFirst({
    where: {
      phoneE164: { in: waIdLookupVariants(input.phone) },
      botConfig: { organizationId: input.trackingOrganizationId },
    },
    orderBy: { isActive: "desc" },
    include: { botConfig: true },
  });
  if (!binding) return { allowed: false };

  // 3. Config da org precisa estar ativa.
  if (!binding.botConfig.isActive) return { allowed: false };

  // 4. Binding precisa estar ativo. Número revogado cai no atendimento normal
  // (não fica em limbo recebendo "acesso desativado" num número compartilhado).
  if (!binding.isActive) return { allowed: false };

  // 5. A tracking que recebeu a mensagem precisa estar HABILITADA pro Astro e
  // NÃO arquivada. Esse é o gate que mantém o número compartilhado seguro:
  // número allow-listado só cai no Astro nas trackings que o admin selecionou
  // e que ainda estão ativas.
  const enabledTracking = await prisma.astroBotTracking.findFirst({
    where: {
      botConfigId: binding.botConfig.id,
      trackingId: input.trackingId,
      tracking: { isArchived: false },
    },
    select: { id: true },
  });
  if (!enabledTracking) return { allowed: false };

  return { allowed: true, binding };
}

/**
 * Supressão do echo do Astro Bot no webhook do Uazapi: a resposta do bot sai
 * pelo número da própria tracking e o Uazapi a ecoa como `fromMe:true`. Sem
 * isso, esse echo viraria Lead/Conversation/Message fantasma (e vazaria a
 * resposta — que pode citar outros leads — como mensagem de CRM). Meta não
 * ecoa mensagens próprias, então só o webhook Uazapi chama isto.
 */
export async function shouldSuppressBotEcho(
  input: BotGateInput,
): Promise<boolean> {
  const gate = await resolveBotGate(input);
  return gate.allowed;
}

const DELIVERY_MEMORY_MS = 10 * 60_000;
const globalForDeliveries = globalThis as unknown as { astroBotSeenDeliveries?: Map<string, number> };
const seenDeliveries = (globalForDeliveries.astroBotSeenDeliveries ??= new Map<string, number>());

/** Marca a entrega como vista; `true` se o mesmo id já passou por aqui há pouco. */
function isRepeatedDelivery(externalMessageId: string | undefined): boolean {
  if (!externalMessageId) return false;
  const now = Date.now();
  for (const [seenId, seenAt] of seenDeliveries) {
    if (now - seenAt > DELIVERY_MEMORY_MS) seenDeliveries.delete(seenId);
  }
  if (seenDeliveries.has(externalMessageId)) return true;
  seenDeliveries.set(externalMessageId, now);
  return false;
}

export async function maybeHandleBotMessage(
  input: WhatsappWebhookHookInput,
): Promise<WhatsappWebhookHookResult> {
  const gate = await resolveBotGate({
    phone: input.fromPhone,
    trackingId: input.trackingId,
    trackingOrganizationId: input.trackingOrganizationId,
  });
  if (!gate.allowed || !gate.binding) return { handled: false };
  const binding = gate.binding;

  // Documento e imagem alimentam o Financeiro; áudio é só outra forma de
  // pedir (spec 0036) e vale para todo membro vinculado.
  // Imagem também serve às demandas do Workspace (spec 0080), com ou sem o Financeiro.
  if (input.media?.kind === "document" && !binding.botConfig.financeEnabled) {
    return { handled: false };
  }
  if (!input.media && !input.messageText.trim() && !input.interactiveReplyId) return { handled: false };

  // Provider de saída precisa estar resolvível ANTES de marcarmos handled:true.
  // Se a tracking habilitada estiver desconectada/sem credencial,
  // resolveOutboundProvider lança — devolvemos handled:false pra mensagem
  // seguir pro atendimento em vez de sumir (bot não responde e a mensagem se
  // perderia). O resultado fica em cache (TTL curto), então o sendText reusa.
  try {
    await resolveOutboundProvider(input.trackingId);
  } catch (providerErr) {
    console.error(
      "[astro-bot/webhook-handler] provider de saída não resolvível — caindo no atendimento",
      { trackingId: input.trackingId, providerErr },
    );
    return { handled: false };
  }

  // Canal provider-agnóstico pela própria tracking.
  const channel = new TrackingProviderBotChannel(input.trackingId);

  // A Meta reenvia o webhook quando a resposta demora (imagem, servidor ocupado). Sem isto a mesma
  // foto era tratada duas vezes e a pessoa recebia a pergunta em dobro.
  if (isRepeatedDelivery(input.externalMessageId)) {
    return { handled: true, bindingId: binding.id, status: "duplicate" };
  }

  // Chegou mensagem do membro: o aviso de inatividade que estivesse contando deixa de valer.
  await notifyBotMessageReceived(binding.id);

  // Executa o bot e envia a resposta — TUDO dentro de try/catch interno.
  // Uma vez aqui, o binding é válido e a mensagem é pro bot; mesmo que algo
  // falhe NO MEIO, NÃO deixamos o webhook cair pro fluxo de atendimento —
  // isso causaria resposta duplicada (bot + chat-ia) e lead fantasma.
  try {
    const commandStartedAt = Date.now();
    const result = await handleBotCommand(
      {
        binding,
        botConfig: binding.botConfig,
        channel,
        trackingId: input.trackingId,
        deviceId: input.deviceId,
        media: input.media,
        interactiveReplyId: input.interactiveReplyId,
        interactiveContextId: input.interactiveContextId,
      },
      input.messageText,
    );

    try {
      const replyStartedAt = Date.now();
      // Nota de voz primeiro, quando a empresa ligou e a resposta pode ser falada (spec 0083).
      // Se a voz falhar, segue o texto de sempre; com "enviar também o texto" desligado, o áudio basta.
      const wasVoiceSent =
        shouldReplyWithVoice(binding.botConfig, result) &&
        (await sendVoiceReply({ binding, settings: binding.botConfig, channel, phone: input.fromPhone, result }));
      if (wasVoiceSent || result.wasAudioInput) {
        console.log(
          `[astro-bot/tempo] audioRecebido=${Boolean(result.wasAudioInput)} respostaEmVoz=${wasVoiceSent} ` +
            `comando=${replyStartedAt - commandStartedAt}ms voz=${Date.now() - replyStartedAt}ms`,
        );
      }
      if (wasVoiceSent && !binding.botConfig.voiceAlsoText) {
        await scheduleInactivityNotice({ bindingId: binding.id, trackingId: input.trackingId, phone: input.fromPhone }, false);
        return { handled: true, bindingId: binding.id, status: result.status };
      }
      const isReplyToAudio = wasVoiceSent || Boolean(result.wasAudioInput);
      // Escolha vira botão; o resto, texto. O canal degrada sozinho quando o
      // provider não aceita menu.
      const sent =
        result.buttons && result.buttons.length > 0
          ? await channel.sendButtons(input.fromPhone, {
              bodyText: result.reply,
              buttons: result.buttons,
              listButtonLabel: result.listButtonLabel,
              isImmediate: isReplyToAudio,
            })
          : await channel.sendText(input.fromPhone, result.reply, { isImmediate: isReplyToAudio });
      rememberOpenQuestion(binding.id, sent.messageId, result.buttons);
    } catch (sendErr) {
      console.error("[astro-bot/webhook-handler] envio falhou", sendErr);
      // O comando rodou, mas a resposta não saiu (token inválido, janela fechada): "ok" aqui escondia isso.
      return { handled: true, bindingId: binding.id, status: "send_failed" };
    }

    await scheduleInactivityNotice(
      { bindingId: binding.id, trackingId: input.trackingId, phone: input.fromPhone },
      (result.toolsCalled ?? []).includes("imagem"),
    );

    return {
      handled: true,
      bindingId: binding.id,
      status: result.status,
    };
  } catch (err) {
    console.error(
      "[astro-bot/webhook-handler] handleBotCommand threw — supressing fallback to atendimento",
      { bindingId: binding.id, err },
    );
    return {
      handled: true,
      bindingId: binding.id,
      status: "partial_failure",
    };
  }
}
