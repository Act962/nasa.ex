"use server";
import { graphFetch } from "./client";
import type { SendMediaInput, SendMessageResponse } from "./types";

/**
 * Envia mídia (image/audio/document/sticker/video) via Cloud API.
 *
 * Aceita `mediaIdOrLink`:
 *   - Se começar com `http://` ou `https://`, vai como `{ link }`.
 *   - Caso contrário, vai como `{ id }` (preferencial — `MediaId` retornado
 *     por `uploadOfficialMedia`).
 *
 * Regras do contrato Meta refletidas aqui:
 *   - `audio` e `sticker` NÃO aceitam `caption`.
 *   - `document` aceita `filename`.
 */
export async function sendOfficialMedia(
  accessToken: string,
  phoneNumberId: string,
  input: SendMediaInput,
): Promise<SendMessageResponse> {
  const mediaObject: Record<string, unknown> = isHttpUrl(input.mediaIdOrLink)
    ? { link: input.mediaIdOrLink }
    : { id: input.mediaIdOrLink };

  const allowsCaption =
    input.kind === "image" ||
    input.kind === "document" ||
    input.kind === "video";
  if (allowsCaption && input.caption) {
    mediaObject.caption = input.caption;
  }

  if (input.kind === "document" && input.filename) {
    mediaObject.filename = input.filename;
  }

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to,
    type: input.kind,
    [input.kind]: mediaObject,
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

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}
