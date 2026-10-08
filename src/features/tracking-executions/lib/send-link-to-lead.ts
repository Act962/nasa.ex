/**
 * Helper compartilhado pelos 7 executors da categoria "Adicionar Lead
 * no App" (SEND_FORM, SEND_AGENDA, SEND_PROPOSAL, SEND_CONTRACT,
 * SEND_LINNKER, SEND_NBOX, SEND_NASA_ROUTE).
 *
 * Espelha **exatamente** o que `sendMessageExecutor` faz no step
 * "send-message" — provedor do tracking + sendText + DB write + Pusher. Diferenças:
 *
 *  - Aceita callback `getResource()` que retorna o recurso já validado
 *    (form, agenda, proposta, etc) — caller fica responsável pela
 *    criação + ownership check
 *  - Integra com In-Chat fallback (PR #72): se `shouldSkipUazapi`
 *    retornar true, salva Message com `viaInChat: true` SEM chamar
 *    uazapi. Lead recebe via `/whatsapp/<orgSlug>` em vez do WhatsApp.
 *  - Single function: tudo num só lugar pra não duplicar nos 7 executors
 *
 * Erros: lança `NonRetriableError` em todas as condições fatais (lead
 * sem phone, instância não existe, etc) — caller já tá dentro de
 * step.run() do Inngest, retry-safe.
 */

import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import {
  type CreatedMessageProps,
  MessageStatus,
} from "@/features/tracking-chat/types";
// `isInChatModeActiveForConversation` é o nome atual na main. PR #72
// renomeia pra `shouldSkipUazapiForConversation` (semanticamente mais
// claro). Quando #72 mergear, trocar pelo novo nome.
import { isInChatModeActiveForConversation as shouldSkipUazapiForConversation } from "@/features/tracking-chat/lib/in-chat-mode";
import { v4 as uuidv4 } from "uuid";
import {
  assertFreeFormWindowOpenForLead,
  resolveWorkflowProvider,
  sendWithWorkflowErrors,
  toStoredMessageId,
  WORKFLOW_TYPING_DELAY_MS,
} from "./workflow-outbound";

export interface SendLinkToLeadParams {
  leadId: string;
  trackingId: string;
  /** Mensagem completa (já com variáveis substituídas e URL incluída). */
  body: string;
}

export async function sendLinkToLead(
  params: SendLinkToLeadParams,
): Promise<{ messageId: string; viaInChat: boolean }> {
  // 1. Lead com phone (pra envio uazapi)
  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    select: {
      id: true,
      phone: true,
      trackingId: true,
      isActive: true,
      tracking: { select: { organizationId: true } },
    },
  });
  if (!lead) {
    throw new NonRetriableError("Lead not found");
  }
  if (!lead.isActive) {
    throw new NonRetriableError("Lead is not active");
  }
  if (!lead.phone) {
    throw new NonRetriableError("Lead phone is missing");
  }

  // 2. Conversation do lead (necessária pra gravar Message)
  const conversation = await prisma.conversation.findFirst({
    where: { leadId: lead.id, trackingId: params.trackingId },
    select: { id: true },
  });
  if (!conversation) {
    throw new NonRetriableError("Conversation not found for lead");
  }

  // 3. In-Chat fallback (PR #72): se instância tá em modo banido auto,
  //    pula uazapi e marca viaInChat. Lead vê via /whatsapp/[slug].
  const skipUazapi = await shouldSkipUazapiForConversation(conversation.id);

  // 4. Envio pelo provedor do tracking (Uazapi ou API Oficial), quando NÃO
  //    em fallback. Provedor e janela de 24h são conferidos antes da cobrança.
  let externalMessageId = `auto-${uuidv4()}`;
  if (!skipUazapi) {
    const resolved = await resolveWorkflowProvider(params.trackingId);
    await assertFreeFormWindowOpenForLead(resolved, {
      leadId: lead.id,
      trackingId: params.trackingId,
    });

    // Cobra 1★ por envio automático. Em in-chat fallback nada sai pelo
    // WhatsApp (mensagem fica visível na página /whatsapp/[slug]) — sem
    // custo de envio externo, então não cobramos esse caminho.
    const charge = await chargeStarsByAction(
      lead.tracking.organizationId,
      "message_send",
      {
        appSlug: "message_send",
        description: "Workflow tracking — envio automático",
      },
    );
    if (!charge.success) {
      throw new NonRetriableError(
        "Saldo de STARs insuficiente pra envio automático.",
      );
    }

    const leadPhone = lead.phone;
    const sent = await sendWithWorkflowErrors(() =>
      resolved.provider.sendText({
        kind: "text",
        to: leadPhone,
        body: params.body,
        typingDelayMs: WORKFLOW_TYPING_DELAY_MS,
      }),
    );
    externalMessageId = toStoredMessageId(sent);
  }

  // 5. Grava Message no DB (sempre — tanto via uazapi quanto via In-Chat)
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      body: params.body,
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

  // 6. Pusher pra atualizar UI em tempo real
  const messageCreated: CreatedMessageProps = {
    ...message,
    currentUserId: "system",
  };
  await pusherServer
    .trigger(message.conversationId, "message:created", messageCreated)
    .catch(() => {
      // Pusher falha não deve derrubar o executor — mensagem já tá no DB
    });

  return { messageId: message.id, viaInChat: skipUazapi };
}
