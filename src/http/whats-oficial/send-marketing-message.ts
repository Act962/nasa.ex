"use server";
import { graphFetch } from "./client";
import type {
  SendMarketingMessageInput,
  SendMessageResponse,
} from "./types";

/**
 * Envia um template de **marketing** via **Marketing Messages API** (MM API)
 * do WhatsApp Business Cloud.
 *
 * `POST /{phone_number_id}/marketing_messages` — otimização de entrega +
 * métricas de marketing. Só aceita **templates de marketing aprovados**;
 * qualquer outro tipo retorna erro da Meta. Espelha `send-template.ts`, mas
 * com `product_policy` e `message_activity_sharing`.
 *
 * Função pura (só `fetch`) — chamada de fato apenas na Fase 3 do app de
 * Campanhas. Ver `docs/campanhas-overview.md`.
 *
 * Ref: https://developers.facebook.com/documentation/business-messaging/whatsapp/marketing-messages/send-marketing-messages
 */
export async function sendMarketingMessage(
  accessToken: string,
  phoneNumberId: string,
  input: SendMarketingMessageInput,
): Promise<SendMessageResponse> {
  const components: Array<Record<string, unknown>> = [];

  if (input.headerParameters?.length) {
    components.push({
      type: "header",
      parameters: input.headerParameters.map((text) => ({
        type: "text",
        text,
      })),
    });
  }

  if (input.bodyParameters?.length) {
    components.push({
      type: "body",
      parameters: input.bodyParameters.map((text) => ({
        type: "text",
        text,
      })),
    });
  }

  const template: Record<string, unknown> = {
    name: input.templateName,
    language: { code: input.languageCode },
  };
  if (components.length > 0) {
    template.components = components;
  }

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to,
    type: "template",
    template,
    product_policy: input.productPolicy ?? "CLOUD_API_FALLBACK",
  };

  if (typeof input.messageActivitySharing === "boolean") {
    body.message_activity_sharing = input.messageActivitySharing;
  }

  return graphFetch<SendMessageResponse>(
    `/${phoneNumberId}/marketing_messages`,
    {
      method: "POST",
      accessToken,
      body,
    },
  );
}
