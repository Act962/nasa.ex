"use server";
import { graphFetch, graphFetchBinary } from "./client";
import type { MediaUrlResponse } from "./types";

/**
 * Resolve a URL **fresca** de uma mídia a partir do `media_id`.
 *
 * A URL `lookaside.fbsbx.com` que vem no webhook expira em ~5 min — se o
 * download falhar com 401/410, chamar essa função para obter uma nova.
 */
export async function getOfficialMediaUrl(
  accessToken: string,
  mediaId: string,
): Promise<MediaUrlResponse> {
  return graphFetch<MediaUrlResponse>(`/${mediaId}`, {
    method: "GET",
    accessToken,
  });
}

/**
 * Baixa o binário de uma mídia. A URL pode ser:
 *   - A `url` lookaside que veio no webhook (se ainda válida), OU
 *   - A `url` fresca devolvida por `getOfficialMediaUrl`.
 *
 * Sempre vai com `Authorization: Bearer` (a URL exige).
 */
export async function downloadOfficialMedia(
  accessToken: string,
  url: string,
): Promise<{ buffer: Buffer; mimetype: string }> {
  return graphFetchBinary(url, accessToken);
}

/**
 * Helper de uma chamada só: dado o `media_id`, resolve url fresca + baixa.
 *
 * É o que o pipeline canônico (Fase 3) usará para mídia inbound da Meta —
 * espelha o papel de `downloadFile` da Uazapi (`src/http/uazapi/get-file.ts`).
 */
export async function downloadInboundMedia(
  accessToken: string,
  mediaId: string,
): Promise<{ buffer: Buffer; mimetype: string; fileSize: number }> {
  const metadata = await getOfficialMediaUrl(accessToken, mediaId);
  const { buffer, mimetype } = await downloadOfficialMedia(
    accessToken,
    metadata.url,
  );
  return {
    buffer,
    mimetype: metadata.mime_type || mimetype,
    fileSize: metadata.file_size,
  };
}
