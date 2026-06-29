"use server";
import { graphFetch } from "./client";
import type { SendMessageResponse, SendTextInput } from "./types";

/**
 * Envia uma mensagem de texto via WhatsApp Business Cloud API.
 *
 * @returns `{ messages: [{ id: "wamid..." }] }` — o `wamid` vai para
 *   `Message.messageId` quando a integração for plugada no chat (Fase 6).
 */
export async function sendOfficialText(
  accessToken: string,
  phoneNumberId: string,
  input: SendTextInput,
): Promise<SendMessageResponse> {
  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to,
    type: "text",
    text: {
      body: input.body,
      ...(input.previewUrl !== undefined && { preview_url: input.previewUrl }),
    },
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
