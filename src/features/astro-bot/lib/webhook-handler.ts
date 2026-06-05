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
  /**
   * Org do tracking que recebeu o webhook. Restringe a interceptação ao
   * binding desta org — evita colisão quando um membro de outra org
   * compartilha o mesmo número WhatsApp de um lead deste tracking.
   */
  trackingOrganizationId: string;
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

  // 2. Restringe à org dona do botConfig — fonte autoritativa. phoneE164 é
  // unique GLOBAL, então o lookup acima pode achar binding de outra org;
  // neste caso a mensagem é de um lead deste tracking que por acaso
  // compartilha o número com um membro de outra org. Usar
  // botConfig.organizationId (em vez do binding.organizationId
  // denormalizado) elimina single point of failure caso os dois campos
  // divirjam por bug/migração futura.
  if (binding.botConfig.organizationId !== input.trackingOrganizationId) {
    return { handled: false };
  }

  // 3. Fail-closed por provider: só intercepta quando a instância dedicada
  // do bot é a mesma que recebeu o webhook. Sem isso, binding de outra org
  // pode sequestrar mensagens de leads que compartilham o número.
  const provider = binding.botConfig.provider;
  const uazapiInstance = binding.botConfig.uazapiInstance;

  if (provider === "UAZAPI") {
    // Requer uazapiInstance vinculada com apiKey E token do webhook batendo.
    // Empty string trata como ausência — config quebrada gera warn dedicado
    // pra ficar visível no log scrubbing.
    if (!uazapiInstance?.apiKey) {
      console.warn(
        "[astro-bot/webhook-handler] binding com provider UAZAPI mas instância sem apiKey",
        {
          bindingId: binding.id,
          organizationId: binding.botConfig.organizationId,
        },
      );
      return { handled: false };
    }
    if (uazapiInstance.apiKey !== input.receivingInstanceToken) {
      return { handled: false };
    }
  } else if (provider === "META_CLOUD") {
    // Fase 2 — verificação por meta_phone_id/access_token ainda não foi
    // implementada. Mesmo assim, devolve handled=true pra SUPRIMIR criação
    // de phantom lead com o phone do membro no tracking. Status sinaliza
    // pro log que a interceptação foi "intencional, mas no-op" e não erro.
    return {
      handled: true,
      bindingId: binding.id,
      status: "provider_not_implemented",
    };
  } else {
    // Exhaustiveness check — se BotProvider ganhar um valor novo, o TS
    // falha aqui e força tratamento explícito.
    const _exhaustive: never = provider;
    void _exhaustive;
    return { handled: false };
  }

  // 4. Roteia pro Astro Bot. Neste ponto provider === UAZAPI e a apiKey foi
  // validada igual ao token do webhook. Re-check pra propagar o narrowing
  // do TS pra fora do if — não é dead code, é só TS não carrega a inferência
  // entre blocos. Belt-and-suspenders ao mesmo tempo.
  if (!uazapiInstance) {
    return { handled: false };
  }

  const channel = new UazapiBotChannel(
    uazapiInstance.apiKey,
    uazapiInstance.baseUrl ?? input.receivingInstanceBaseUrl,
  );

  // 5. Executa o bot e envia a resposta — TUDO dentro de um try/catch
  // interno. Uma vez que chegamos aqui, o binding é válido e a mensagem é
  // pro bot; mesmo que handleBotCommand falhe NO MEIO (depois de debitar
  // Stars, persistir WhatsappBotCommand ou enviar resposta parcial), NÃO
  // podemos deixar o webhook cair pro fluxo de atendimento — isso causaria
  // resposta duplicada (bot + chat-ia) e lead fantasma. Devolvemos
  // handled=true com status=partial_failure pro caller saber que a mensagem
  // foi reconhecida como bot mas algo deu errado.
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
      console.error(
        "[astro-bot/webhook-handler] sendText failed",
        sendErr,
      );
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
