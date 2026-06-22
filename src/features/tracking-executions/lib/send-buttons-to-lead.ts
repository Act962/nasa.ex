/**
 * Helper de envio de menu de botões pro lead — versão "buttons" do
 * `sendLinkToLead`. Usado pelo executor de SEND_MESSAGE quando o payload
 * é do tipo BUTTONS (preset existente ou inline ad-hoc).
 *
 * Diferenças vs `sendLinkToLead`:
 *  - Chama `sendButtons` (uazapi /send/menu type=button) em vez de `sendText`
 *  - Aceita `bodyText`, `footerText?`, `buttons[]` em vez de `body`
 *  - Persiste Message com body formatado (texto + lista enumerada de botões)
 *    pra histórico fazer sentido na UI do chat
 *
 * Mesma garantia in-chat fallback (PR #72) — se instância banida, salva
 * Message com viaInChat=true SEM chamar uazapi.
 */
import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { sendButtonsOrList } from "@/http/uazapi/send-menu";
import {
  type CreatedMessageProps,
  MessageStatus,
} from "@/features/tracking-chat/types";
import { isInChatModeActiveForConversation as shouldSkipUazapiForConversation } from "@/features/tracking-chat/lib/in-chat-mode";
import { v4 as uuidv4 } from "uuid";

export interface SendButtonsToLeadParams {
  leadId: string;
  trackingId: string;
  bodyText: string;
  footerText?: string;
  buttons: Array<{ text: string; id: string }>;
}

export async function sendButtonsToLead(
  params: SendButtonsToLeadParams,
): Promise<{ messageId: string; viaInChat: boolean }> {
  const { leadId, trackingId, bodyText, footerText, buttons } = params;

  if (buttons.length === 0) {
    throw new NonRetriableError("Menu de botões sem opções");
  }
  if (!bodyText.trim()) {
    throw new NonRetriableError("Menu de botões sem texto principal");
  }

  // 1. Lead com phone
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, phone: true, trackingId: true, isActive: true },
  });
  if (!lead) throw new NonRetriableError("Lead not found");
  if (!lead.isActive) throw new NonRetriableError("Lead is not active");
  if (!lead.phone) throw new NonRetriableError("Lead phone is missing");

  // 2. Conversation
  const conversation = await prisma.conversation.findFirst({
    where: { leadId: lead.id, trackingId },
    select: { id: true },
  });
  if (!conversation) {
    throw new NonRetriableError("Conversation not found for lead");
  }

  // 3. In-chat fallback
  const skipUazapi = await shouldSkipUazapiForConversation(conversation.id);

  // 4. Envia via uazapi (ou pula no fallback). Flags `readchat` +
  //    `readmessages` espelham o que o tool do Chatbot IA usa em prod
  //    (src/features/tracking-chat-ai/server/tools/send-buttons.ts) —
  //    marca a conversa como lida do lado do WhatsApp pra não acumular
  //    badge de não-lida.
  let externalMessageId = `auto-${uuidv4()}`;
  if (!skipUazapi) {
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { trackingId },
      select: { apiKey: true, baseUrl: true },
    });
    if (!instance) {
      throw new NonRetriableError("WhatsApp instance not found for tracking");
    }
    // Wrapper auto-degrada pra `sendList` se buttons.length > 3 (WhatsApp
    // só aceita 3 botões nativos; acima disso vira menu de lista com o
    // mesmo UX de seleção pro lead).
    const response = await sendButtonsOrList(
      instance.apiKey,
      {
        number: lead.phone,
        text: bodyText,
        buttons,
        footer: footerText || undefined,
        readchat: true,
        readmessages: true,
        delay: 2000,
      },
      instance.baseUrl,
    );
    externalMessageId = response.messageid ?? externalMessageId;
  }

  // 5. Persiste Message — body inclui texto + opções pro histórico
  const bodyFormatted = formatBodyWithButtons(bodyText, footerText, buttons);
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      body: bodyFormatted,
      messageId: externalMessageId,
      fromMe: true,
      status: MessageStatus.SENT,
      quotedMessageId: null,
      viaInChat: skipUazapi,
    },
    include: {
      conversation: { include: { lead: true } },
    },
  });

  // 6. Pusher
  const messageCreated: CreatedMessageProps = {
    ...message,
    currentUserId: "system",
  };
  await pusherServer
    .trigger(message.conversationId, "message:created", messageCreated)
    .catch(() => {
      // Pusher falha não derruba o executor
    });

  return { messageId: message.id, viaInChat: skipUazapi };
}

/**
 * Espelha o format que o tool do Chatbot IA usa pra persistir mensagem
 * (`tracking-chat-ai/server/tools/send-buttons.ts:57-58`) pra manter
 * histórico do chat consistente entre IA e automação.
 */
function formatBodyWithButtons(
  bodyText: string,
  footerText: string | undefined,
  buttons: Array<{ text: string; id: string }>,
): string {
  const summary = buttons.map((b) => `• ${b.text}`).join("\n");
  const body = `${bodyText.trim()}\n\n[Botões]\n${summary}`;
  return footerText?.trim() ? `${body}\n\n${footerText.trim()}` : body;
}
