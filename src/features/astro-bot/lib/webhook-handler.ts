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
import prisma from "@/lib/prisma";
import { handleBotCommand } from "./router";
import { TrackingProviderBotChannel } from "./tracking-provider-channel";

export interface WhatsappWebhookHookInput {
  /** Phone do remetente da mensagem WhatsApp, formato E.164 sem `+`. */
  fromPhone: string;
  /** Texto plain da mensagem. Só processamos texto — mídia ignora. */
  messageText: string;
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

export async function maybeHandleBotMessage(
  input: WhatsappWebhookHookInput,
): Promise<WhatsappWebhookHookResult> {
  // 1. Lookup binding por phone — index unique, rápido.
  const binding = await prisma.userWhatsappBinding.findUnique({
    where: { phoneE164: input.fromPhone },
    include: { botConfig: true },
  });

  if (!binding) return { handled: false };

  // 2. Restringe à org dona do botConfig — fonte autoritativa. phoneE164 é
  // unique GLOBAL, então o lookup acima pode achar binding de outra org;
  // neste caso a mensagem é de um lead desta tracking que por acaso
  // compartilha o número com um membro de outra org.
  if (binding.botConfig.organizationId !== input.trackingOrganizationId) {
    return { handled: false };
  }

  // 3. Config precisa estar ativa.
  if (!binding.botConfig.isActive) {
    return { handled: false };
  }

  // 4. A tracking que recebeu a mensagem precisa estar HABILITADA pro Astro.
  // Esse é o gate que mantém o número compartilhado seguro: número
  // allow-listado só cai no Astro nas trackings que o admin selecionou.
  const enabledTracking = await prisma.astroBotTracking.findUnique({
    where: {
      botConfigId_trackingId: {
        botConfigId: binding.botConfig.id,
        trackingId: input.trackingId,
      },
    },
    select: { id: true },
  });
  if (!enabledTracking) {
    return { handled: false };
  }

  // 5. Canal provider-agnóstico pela própria tracking.
  const channel = new TrackingProviderBotChannel(input.trackingId);

  // 6. Executa o bot e envia a resposta — TUDO dentro de try/catch interno.
  // Uma vez aqui, o binding é válido e a mensagem é pro bot; mesmo que algo
  // falhe NO MEIO, NÃO deixamos o webhook cair pro fluxo de atendimento —
  // isso causaria resposta duplicada (bot + chat-ia) e lead fantasma.
  try {
    const result = await handleBotCommand(
      {
        binding,
        botConfig: binding.botConfig,
        channel,
        deviceId: input.deviceId,
      },
      input.messageText,
    );

    try {
      await channel.sendText(input.fromPhone, result.reply);
    } catch (sendErr) {
      console.error("[astro-bot/webhook-handler] sendText failed", sendErr);
    }

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
