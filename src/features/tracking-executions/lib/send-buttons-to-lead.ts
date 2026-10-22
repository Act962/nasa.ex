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
import { sendText } from "@/http/uazapi/send-text";
import { formatNumberedMenu, isButtonsOfficialOnly, numberedMenuMetadata } from "@/features/tracking-chat/lib/numbered-menu";
import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { sendButtonsOrList, sendItemsAsList } from "@/http/uazapi/send-menu";
import {
  type CreatedMessageProps,
  MessageStatus,
} from "@/features/tracking-chat/types";
import { isInChatModeActiveForConversation as shouldSkipUazapiForConversation } from "@/features/tracking-chat/lib/in-chat-mode";
import { v4 as uuidv4 } from "uuid";
import {
  requireUazapiMenuCredentials,
  resolveWorkflowProvider,
  sendWithWorkflowErrors,
} from "./workflow-outbound";
import { OFFICIAL_MENU_LIMITS, isMetaInteractiveOn } from "@/features/workflows/lib/button-reply-flow";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { flowOriginMetadata, type FlowMessageOrigin } from "@/features/workflows/lib/flow-origin";

export interface SendButtonsToLeadParams {
  leadId: string;
  trackingId: string;
  bodyText: string;
  footerText?: string;
  // tagId opcional por botão — quando presente, grava buttonTagMap no
  // metadata da Message pra o webhook aplicar a tag no clique do lead.
  buttons: Array<{ text: string; id: string; tagId?: string }>;
  // LIST envia a mesma composição de itens como lista; BUTTON (default) como
  // botões. `listButton` é o rótulo que abre a lista (default "Ver opções").
  menuFormat?: "BUTTON" | "LIST";
  listButton?: string;
  /** Cobra o envio como o modo normal cobra (1 envio = `message_send`). */
  chargeStars?: boolean;
  /** Passo de fluxo que mandou: o chat mostra "Editar gatilho" (spec 0113, RF-20). */
  origin?: FlowMessageOrigin | null;
}

export async function sendButtonsToLead(
  params: SendButtonsToLeadParams,
): Promise<{ messageId: string; viaInChat: boolean }> {
  const { leadId, trackingId, bodyText, footerText, buttons } = params;
  const asList = params.menuFormat === "LIST";

  if (buttons.length === 0) {
    throw new NonRetriableError("Menu de botões sem opções");
  }
  if (!bodyText.trim()) {
    throw new NonRetriableError("Menu de botões sem texto principal");
  }

  // 1. Lead com phone
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      phone: true,
      trackingId: true,
      tracking: { select: { organizationId: true } },
    },
  });
  if (!lead) throw new NonRetriableError("Lead not found");
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
  let isSentAsNumberedText = false;
  const numberedOptions = buttons.filter((button) => button.id).map((button) => ({ id: button.id, title: button.text }));
  const resolvedProvider = skipUazapi ? null : await resolveWorkflowProvider(trackingId);
  // Em modo In-Chat nada sai pelo WhatsApp: sem custo de envio, como no `sendLinkToLead`.
  if (resolvedProvider && params.chargeStars) {
    const charge = await chargeStarsByAction(lead.tracking.organizationId, "message_send", {
      appSlug: "message_send",
      description: "Workflow tracking — envio de menu de botões",
    });
    if (!charge.success) {
      throw new NonRetriableError("Saldo de STARs insuficiente pra envio automático.");
    }
  }
  const sendOfficialInteractive =
    resolvedProvider && !resolvedProvider.uazapiToken && isMetaInteractiveOn()
      ? resolvedProvider.provider.sendInteractive?.bind(resolvedProvider.provider)
      : undefined;
  if (resolvedProvider && sendOfficialInteractive) {
    // API oficial (spec 0090, seção F): até 3 botões ou 10 itens de lista, com título curto. Fora
    // disso a Meta recusa; melhor falhar aqui com uma frase clara do que mandar algo cortado.
    const maxOptions = asList ? OFFICIAL_MENU_LIMITS.maxListRows : OFFICIAL_MENU_LIMITS.maxButtons;
    const maxTitleChars = asList ? OFFICIAL_MENU_LIMITS.listRowTitleChars : OFFICIAL_MENU_LIMITS.buttonTitleChars;
    if (buttons.length > maxOptions) {
      throw new NonRetriableError(`A API oficial aceita no máximo ${maxOptions} ${asList ? "itens na lista" : "botões"} por mensagem.`);
    }
    const longButton = buttons.find((button) => button.text.length > maxTitleChars);
    if (longButton) {
      throw new NonRetriableError(`A opção "${longButton.text}" passa de ${maxTitleChars} caracteres, o limite da API oficial.`);
    }
    const sent = await sendWithWorkflowErrors(() =>
      sendOfficialInteractive({
        kind: "interactive",
        to: lead.phone as string,
        body: bodyText,
        footer: footerText || undefined,
        options: buttons.map((button) => ({ id: button.id, title: button.text })),
        listButtonLabel: asList ? params.listButton?.trim() || "Ver opções" : undefined,
      }),
    );
    externalMessageId = sent.externalMessageId ?? externalMessageId;
  } else if (resolvedProvider && resolvedProvider.uazapiToken && isButtonsOfficialOnly()) {
    // Número fora da API oficial (spec 0095): o menu sai como texto numerado, sem botão nem lista.
    const menuCredentials = requireUazapiMenuCredentials(resolvedProvider);
    const sentText = await sendText(
      menuCredentials.token,
      { number: lead.phone, text: formatNumberedMenu({ body: bodyText, options: numberedOptions, footer: footerText }), readchat: true, readmessages: true, delay: 2000 },
      menuCredentials.baseUrl,
    );
    externalMessageId = sentText.messageid ?? externalMessageId;
    isSentAsNumberedText = true;
  } else if (resolvedProvider) {
    const menuCredentials = requireUazapiMenuCredentials(resolvedProvider);
    const response = asList
      ? await sendItemsAsList(
          menuCredentials.token,
          {
            number: lead.phone,
            text: bodyText,
            items: buttons,
            footer: footerText || undefined,
            button: params.listButton,
            readchat: true,
            readmessages: true,
            delay: 2000,
          },
          menuCredentials.baseUrl,
        )
      : await sendButtonsOrList(
          menuCredentials.token,
          {
            number: lead.phone,
            text: bodyText,
            buttons,
            footer: footerText || undefined,
            readchat: true,
            readmessages: true,
            delay: 2000,
          },
          menuCredentials.baseUrl,
        );
    externalMessageId = response.messageid ?? externalMessageId;
  }

  // 5. Persiste Message — body inclui texto + opções pro histórico
  const bodyFormatted = isSentAsNumberedText
    ? formatNumberedMenu({ body: bodyText, options: numberedOptions, footer: footerText })
    : formatBodyWithButtons(bodyText, footerText, buttons, asList ? (params.listButton?.trim() || "Ver opções") : null);
  // buttonTagMap (buttonId→tagId) — grava no metadata pra o webhook aplicar
  // a tag quando o lead clicar num botão com tag associada.
  const buttonTagMap: Record<string, string> = {};
  for (const button of buttons) {
    if (button.id && button.tagId) {
      buttonTagMap[button.id] = button.tagId;
    }
  }
  const hasTagMap = Object.keys(buttonTagMap).length > 0;
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      body: bodyFormatted,
      messageId: externalMessageId,
      fromMe: true,
      status: MessageStatus.SENT,
      quotedMessageId: null,
      viaInChat: skipUazapi,
      ...(hasTagMap || isSentAsNumberedText || params.origin
        ? {
            metadata: {
              ...(hasTagMap ? { buttonTagMap } : {}),
              ...(isSentAsNumberedText ? numberedMenuMetadata(numberedOptions) : {}),
              ...flowOriginMetadata(params.origin),
            },
          }
        : {}),
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

  // Mensagem de fluxo também é resposta ao cliente (spec 0099): sem isto, quem conversava com um
  // fluxo aparecia como "sem resposta" e ganhava "Aguard. atendimento" 15 minutos depois.
  await prisma.lead.update({ where: { id: lead.id }, data: { lastOutboundAt: new Date() } }).catch(() => undefined);
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
  listLabel: string | null,
): string {
  const summary = buttons.map((b) => `• ${b.text}`).join("\n");
  const header = listLabel ? `[Lista: ${listLabel}]` : "[Botões]";
  const body = `${bodyText.trim()}\n\n${header}\n${summary}`;
  return footerText?.trim() ? `${body}\n\n${footerText.trim()}` : body;
}
