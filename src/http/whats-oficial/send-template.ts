"use server";
import { graphFetch } from "./client";
import type { SendMessageResponse, SendTemplateInput } from "./types";

/**
 * Envia uma mensagem de **template** (HSM) via WhatsApp Business Cloud API.
 *
 * Usado pra abrir conversa fora da janela de 24h de atendimento — texto
 * livre só é aceito dentro dela. O template precisa estar `APPROVED` na WABA.
 *
 * Nesta fase preenchemos só variáveis de **body** e header de **texto** (uma
 * `{ type:"text", text }` por placeholder `{{n}}`, na ordem). Header de mídia
 * e botões dinâmicos ficam pra Fase 10.
 *
 * Ref: https://developers.facebook.com/documentation/business-messaging/whatsapp/marketing-messages/send-marketing-messages
 */
export async function sendOfficialTemplate(
  accessToken: string,
  phoneNumberId: string,
  input: SendTemplateInput,
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
  };

  if (input.replyToWamid) {
    body.context = { message_id: input.replyToWamid };
  }

  return graphFetch<SendMessageResponse>(`/${phoneNumberId}/messages`, {
    method: "POST",
    accessToken,
    body,
  });
}
