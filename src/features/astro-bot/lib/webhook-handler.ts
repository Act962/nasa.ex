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
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers/resolve-outbound-provider";
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
async function resolveBotGate(input: BotGateInput): Promise<BotGateResult> {
  // 1. Lookup binding por phone — index unique, rápido.
  const binding = await prisma.userWhatsappBinding.findUnique({
    where: { phoneE164: input.phone },
    include: { botConfig: true },
  });
  if (!binding) return { allowed: false };

  // 2. Restringe à org dona do botConfig — fonte autoritativa. phoneE164 é
  // unique GLOBAL, então o lookup acima pode achar binding de outra org;
  // neste caso a mensagem é de um lead desta tracking que por acaso
  // compartilha o número com um membro de outra org.
  if (binding.botConfig.organizationId !== input.trackingOrganizationId) {
    return { allowed: false };
  }

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

  // Executa o bot e envia a resposta — TUDO dentro de try/catch interno.
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
