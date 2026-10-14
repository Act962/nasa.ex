import "server-only";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers/resolve-outbound-provider";
import type { WhatsAppChatProvider } from "@/features/tracking-chat/lib/providers/types";
import { getCustomerWindow } from "@/features/tracking-chat/lib/customer-window";
import { persistOutboundMessage } from "@/features/tracking-chat-ai/lib/persist";
import { shouldReplyInPortal } from "../order-channel";
import { APPROVAL_TEMPLATE_LANGUAGE, isWithinServiceWindow, toTemplateParameter } from "./approval-rules";

export type QuickButton = { id: string; title: string };

export type TemplateFallback = {
  name: string;
  bodyParameters: Array<string | null | undefined>;
  /** Payload por botão de resposta rápida, na ordem do template. */
  quickReplyPayloads?: string[];
  /** Sufixo da URL dinâmica do botão de link (índice informado). */
  urlButton?: { index: number; suffix: string };
};

export type DeliveryResult =
  | { isSent: true; via: "text" | "interactive" | "template"; externalMessageId: string }
  | { isSent: false; reason: string };

function describeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : "whatsapp_send_failed";
}

// Dentro da janela de 24h: texto (ou botões). Fora dela, na API oficial, só template aprovado.
async function sendThroughProvider(params: {
  provider: WhatsAppChatProvider;
  isOfficial: boolean;
  to: string;
  isWithinWindow: boolean;
  text: string;
  buttons?: QuickButton[];
  template?: TemplateFallback;
}): Promise<DeliveryResult> {
  const { provider, to } = params;
  try {
    if (params.isOfficial && !params.isWithinWindow) {
      if (!params.template) return { isSent: false, reason: "outside_window_without_template" };
      const quickReplies = (params.template.quickReplyPayloads ?? []).map((payload, index) => ({
        index,
        subType: "quick_reply" as const,
        value: payload,
      }));
      const urlButtons = params.template.urlButton
        ? [{ index: params.template.urlButton.index, subType: "url" as const, value: params.template.urlButton.suffix }]
        : [];
      const result = await provider.sendTemplate({
        kind: "template",
        to,
        templateName: params.template.name,
        languageCode: APPROVAL_TEMPLATE_LANGUAGE,
        bodyParameters: params.template.bodyParameters.map((value) => toTemplateParameter(value)),
        buttonParameters: [...quickReplies, ...urlButtons],
      });
      return { isSent: true, via: "template", externalMessageId: result.externalMessageId };
    }
    if (params.buttons?.length && provider.sendInteractive) {
      const result = await provider.sendInteractive({
        kind: "interactive",
        to,
        body: params.text,
        options: params.buttons.map((button) => ({ id: button.id, title: button.title.slice(0, 20) })),
      });
      return { isSent: true, via: "interactive", externalMessageId: result.externalMessageId };
    }
    const result = await provider.sendText({ kind: "text", to, body: params.text });
    return { isSent: true, via: "text", externalMessageId: result.externalMessageId };
  } catch (error) {
    return { isSent: false, reason: describeError(error) };
  }
}

/** Mensagem interna para um aprovador, pelo número oficial da loja (spec 0104, D-1). Não grava no chat de clientes. */
export async function sendApproverMessage(params: {
  trackingId: string;
  phoneE164: string;
  lastInboundAt: Date | null;
  text: string;
  buttons?: QuickButton[];
  /** Ausente só em resposta logo após o aprovador escrever (janela aberta). */
  template?: TemplateFallback;
}): Promise<DeliveryResult> {
  const resolved = await resolveOutboundProvider(params.trackingId).catch(() => null);
  if (!resolved) return { isSent: false, reason: "no_whatsapp_instance" };
  return sendThroughProvider({
    provider: resolved.provider,
    isOfficial: resolved.providerId === "meta-cloud",
    to: params.phoneE164,
    isWithinWindow: isWithinServiceWindow(params.lastInboundAt, new Date()),
    text: params.text,
    buttons: params.buttons,
    template: params.template,
  });
}

/** Mensagem ao cliente do pedido: fica sempre no chat/portal e sai no WhatsApp pelo caminho que a Meta aceita. */
export async function sendCustomerMessage(params: {
  conversationId: string;
  senderName: string;
  text: string;
  buttons?: QuickButton[];
  template?: TemplateFallback;
  metadata?: Prisma.InputJsonValue | null;
  /** Avisos de etapa vão ao WhatsApp mesmo quando o cliente só falou pelo acompanhamento. */
  isWhatsappForced?: boolean;
}): Promise<DeliveryResult> {
  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: params.conversationId },
    select: { trackingId: true, leadId: true, lead: { select: { phone: true } } },
  });
  const phone = conversation.lead.phone;
  let result: DeliveryResult = { isSent: false, reason: phone ? "portal_only" : "no_phone" };

  if (phone && (params.isWhatsappForced || !(await shouldReplyInPortal(params.conversationId)))) {
    const resolved = await resolveOutboundProvider(conversation.trackingId).catch(() => null);
    if (resolved) {
      const window = await getCustomerWindow(params.conversationId);
      result = await sendThroughProvider({
        provider: resolved.provider,
        isOfficial: resolved.providerId === "meta-cloud",
        to: phone,
        isWithinWindow: window.withinWindow,
        text: params.text,
        buttons: params.buttons,
        template: params.template,
      });
    } else {
      result = { isSent: false, reason: "no_whatsapp_instance" };
    }
  }

  await persistOutboundMessage({
    conversationId: params.conversationId,
    leadId: conversation.leadId,
    trackingId: conversation.trackingId,
    body: params.text,
    senderName: params.senderName,
    externalMessageId: result.isSent ? result.externalMessageId : `inchat-${randomUUID()}`,
    metadata: params.metadata ?? null,
  });
  if (!result.isSent) console.warn("[nerp-catalog/approvals] mensagem ao cliente ficou só no chat", result.reason);
  return result;
}
