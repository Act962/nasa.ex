/**
 * Hook a ser chamado no início de `/api/chat/webhook/route.ts`:
 *   se o phone do remetente bate com algum `UserWhatsappBinding`, este
 *   handler intercepta a mensagem, roda o Astro Bot router, e retorna
 *   `handled: true` — o webhook não deve seguir pro fluxo de atendimento
 *   normal (criar Lead/Conversation/Message).
 *
 * Resolve o binding via lookup por phone exato. Lookup é rápido pois
 * `phone_e164` tem unique index.
 */
import "server-only";
import prisma from "@/lib/prisma";
import { handleBotCommand } from "./router";
import { UazapiBotChannel } from "./uazapi-channel";

export interface WhatsappWebhookHookInput {
  /** Phone do remetente da mensagem WhatsApp, formato E.164 sem `+`. */
  fromPhone: string;
  /** Texto plain da mensagem. Pra MVP só processamos texto — mídia ignora. */
  messageText: string;
  /**
   * Token uazapi da instância que recebeu o webhook (`json.token` no payload).
   * Usado pra confirmar que essa msg veio da instância DEDICADA do bot, não
   * da instância de atendimento.
   */
  receivingInstanceToken: string;
  /** baseUrl da uazapi (opcional, default do env). */
  receivingInstanceBaseUrl?: string;
  /** deviceId da uazapi pra detectar SIM swap. */
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
    include: {
      botConfig: {
        include: { uazapiInstance: true },
      },
    },
  });

  if (!binding) return { handled: false };

  // 2. Confirma que o token da instância que recebeu o webhook bate com
  // o `uazapiInstanceId` do botConfig — evita processar binding errado
  // quando o user é membro de várias orgs (cada org tem instância própria).
  const expectedToken = binding.botConfig.uazapiInstance?.apiKey;
  if (expectedToken && expectedToken !== input.receivingInstanceToken) {
    // Phone do binding bate, mas a instância não — provavelmente o user
    // é binding em outra org e essa msg veio pra instância dela.
    // Deixa o fluxo normal de atendimento processar.
    return { handled: false };
  }

  // 3. Roteia pro Astro Bot.
  const channel = new UazapiBotChannel(
    binding.botConfig.uazapiInstance?.apiKey ?? input.receivingInstanceToken,
    binding.botConfig.uazapiInstance?.baseUrl ??
      input.receivingInstanceBaseUrl,
  );

  const result = await handleBotCommand(
    {
      binding,
      botConfig: binding.botConfig,
      channel,
      deviceId: input.deviceId,
    },
    input.messageText,
  );

  // 4. Envia a resposta de volta via WhatsApp.
  try {
    await channel.sendText(input.fromPhone, result.reply);
  } catch (err) {
    console.error(
      "[astro-bot/webhook-handler] sendText failed",
      err,
    );
  }

  return {
    handled: true,
    bindingId: binding.id,
    status: result.status,
  };
}
