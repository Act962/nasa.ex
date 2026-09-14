import "server-only";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers/resolve-outbound-provider";
import { updateConversationLastMessage } from "@/app/router/message/utils";
import { normalizeWhatsappPhoneBr } from "@/features/trafego/lib/phone";
import { loadTrafegoSettings } from "./trafego-settings";

/**
 * Mensagem do sistema para o cliente pelo número da equipe (instância do
 * tracking de operação).
 *
 * Meta Cloud fora da janela de 24 h só aceita template aprovado — por isso o
 * caller passa `template` (nome + parâmetros) e o texto equivalente. Sem
 * template, tentamos texto (funciona se o cliente falou conosco nas últimas
 * 24 h). Uazapi não tem essa regra: vai texto direto.
 *
 * Best-effort: nunca lança. A mensagem é persistida na conversa do lead para
 * aparecer no card do tracking, como qualquer outra.
 */
export interface SendClientWhatsappInput {
  phone: string | null | undefined;
  leadId?: string | null;
  text: string;
  template?: {
    name: string | null;
    language: string;
    bodyParameters: string[];
  } | null;
}

export type SendClientWhatsappResult =
  | { sent: true; via: "template" | "text"; externalMessageId: string }
  | { sent: false; reason: string };

export async function sendTrafegoClientWhatsapp(
  input: SendClientWhatsappInput,
): Promise<SendClientWhatsappResult> {
  const settings = await loadTrafegoSettings();
  const trackingId = settings.operationsTrackingId;
  if (!trackingId) return { sent: false, reason: "no_operations_tracking" };

  const to = normalizeWhatsappPhoneBr(input.phone);
  if (!to) return { sent: false, reason: "no_phone" };

  let resolved: Awaited<ReturnType<typeof resolveOutboundProvider>>;
  try {
    resolved = await resolveOutboundProvider(trackingId);
  } catch (error) {
    console.warn("[trafego/whatsapp] instância indisponível:", error);
    return { sent: false, reason: "no_instance" };
  }

  const useTemplate = resolved.providerId === "meta-cloud" && Boolean(input.template?.name);

  let externalMessageId: string;
  try {
    if (useTemplate && input.template?.name) {
      const response = await resolved.provider.sendTemplate({
        kind: "template",
        to,
        templateName: input.template.name,
        languageCode: input.template.language,
        bodyParameters: input.template.bodyParameters,
      });
      externalMessageId = response.externalMessageId;
    } else {
      const response = await resolved.provider.sendText({
        kind: "text",
        to,
        body: input.text,
        previewUrl: true,
      });
      externalMessageId = response.externalMessageId;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[trafego/whatsapp] envio falhou para ${to}: ${message}`);
    return { sent: false, reason: `send_failed: ${message}` };
  }

  if (input.leadId) {
    await persistOutboundMessage({
      leadId: input.leadId,
      trackingId,
      to,
      body: input.text,
      externalMessageId,
    }).catch((error) =>
      console.warn("[trafego/whatsapp] mensagem enviada mas não registrada na conversa:", error),
    );
  }

  return { sent: true, via: useTemplate ? "template" : "text", externalMessageId };
}

async function persistOutboundMessage(params: {
  leadId: string;
  trackingId: string;
  to: string;
  body: string;
  externalMessageId: string;
}) {
  const conversation =
    (await prisma.conversation.findUnique({
      where: { leadId: params.leadId },
      select: { id: true },
    })) ??
    (await prisma.conversation.create({
      data: {
        remoteJid: `${params.to}@s.whatsapp.net`,
        trackingId: params.trackingId,
        leadId: params.leadId,
        isActive: true,
      },
      select: { id: true },
    }));

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      body: params.body,
      messageId: params.externalMessageId,
      fromMe: true,
      status: "SENT",
      senderName: "trafeGO",
    },
    select: {
      id: true,
      messageId: true,
      body: true,
      createdAt: true,
      fromMe: true,
      status: true,
      conversationId: true,
      senderName: true,
    },
  });

  await updateConversationLastMessage(conversation.id, message.id, message.createdAt);

  await pusherServer
    .trigger(conversation.id, "message:created", { ...message, currentUserId: null })
    .catch(() => {});
}
