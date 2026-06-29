"use server";
import { graphFetchMultipart } from "./client";
import type { MediaUploadResponse, UploadMediaInput } from "./types";

/**
 * Faz upload de uma mídia para a Meta antes de enviar uma mensagem.
 *
 * Vantagens sobre enviar por `link`:
 *   - URL própria não precisa ser pública/acessível pela Meta.
 *   - A Meta valida o arquivo na hora do upload.
 *
 * Retorna `{ id }` — esse `MediaId` é passado em `sendOfficialMedia` no campo
 * `mediaIdOrLink` (irá como `{ id }` no body).
 */
export async function uploadOfficialMedia(
  accessToken: string,
  phoneNumberId: string,
  input: UploadMediaInput,
): Promise<MediaUploadResponse> {
  const formData = new FormData();
  formData.append("messaging_product", "whatsapp");
  formData.append("type", input.mimetype);

  const fileBlob =
    input.file instanceof Blob
      ? input.file
      : // Buffer → Blob (Node 20+; o `globalThis.Blob` existe nativamente).
        new Blob([new Uint8Array(input.file)], { type: input.mimetype });

  formData.append("file", fileBlob, input.filename || "upload");

  return graphFetchMultipart<MediaUploadResponse>(`/${phoneNumberId}/media`, {
    method: "POST",
    accessToken,
    formData,
  });
}
