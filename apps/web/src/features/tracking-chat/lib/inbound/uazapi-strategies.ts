/**
 * Strategies da Uazapi pra `persistCanonicalInbound`.
 *
 * O pipeline canônico é provider-agnostic — quem mora aqui é a parte
 * Uazapi-específica do trajeto inbound:
 *
 *  - `buildUazapiFetchProfilePicture` — baixa o avatar de um novo lead via
 *    `/chat/details` (token Uazapi) e sobe pro S3/R2.
 *  - `buildUazapiDownloadInboundMedia` — baixa o binário de uma mensagem
 *    de mídia inbound via `/message/download` (token Uazapi) e sobe pro
 *    S3/R2 também.
 *
 * Cada factory recebe o `token` da instância Uazapi (vindo do webhook) e
 * devolve uma função fechada sobre esse token — pronta pra ser passada
 * em `PersistCanonicalInboundContext.fetchProfilePicture` /
 * `downloadInboundMedia`.
 *
 * Comportamento espelha 1:1 o que `src/app/api/chat/webhook/route.ts`
 * fazia inline antes da Fase 3 (linhas 164-195 do profile pic; 516-808
 * do media download), com timeout, fallback de mimetype e logs idênticos.
 */
import "server-only";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

import { downloadFile } from "@/http/uazapi/get-file";
import { getContactDetails } from "@/http/uazapi/get-contact-details";
import { S3 } from "@/lib/s3-client";

import type {
  CanonicalInboundMedia,
  CanonicalInboundSender,
} from "../providers/types";
import type {
  FetchProfilePicture,
  DownloadInboundMedia,
  ProfilePictureUpload,
  InboundMediaUpload,
} from "./persist-canonical-inbound";

const FETCH_TIMEOUT_MS = 10_000;

/**
 * Strategy: baixa o avatar de um lead Uazapi via `/chat/details` e sobe
 * pro S3. Retorna `null` se a Uazapi não tiver foto pública, se o download
 * falhar, ou se o upload no S3 falhar (best-effort, lead segue sem avatar).
 */
export function buildUazapiFetchProfilePicture(
  token: string,
): FetchProfilePicture {
  return async function uazapiFetchProfilePicture(
    sender: CanonicalInboundSender,
  ): Promise<ProfilePictureUpload | null> {
    try {
      const details = await getContactDetails({
        token,
        data: { number: sender.phone, preview: false },
      });
      if (!details?.image) return null;

      const imageResponse = await fetch(details.image, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!imageResponse.ok) return null;

      const arrayBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimetype =
        imageResponse.headers.get("content-type") || "image/jpeg";
      const extension = mimetype.split("/")[1] || "jpg";
      const key = `${uuidv4()}.${extension}`;

      await S3.send(
        new PutObjectCommand({
          Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
          Key: key,
          Body: buffer,
          ContentType: mimetype,
        }),
      );
      return { key, mimetype };
    } catch (error) {
      console.error("[uazapi-strategies] profile_pic_failed", error);
      return null;
    }
  };
}

/**
 * Strategy: baixa o binário de uma mensagem de mídia inbound via
 * `/message/download` da Uazapi e sobe pro S3. A URL lookaside da Uazapi
 * é interna do endpoint — fazemos GET nela com `Authorization` implícito.
 *
 * Para áudio, requisita `generate_mp3: true` (paridade com webhook antigo
 * — Uazapi entrega `.ogg` por padrão mas convertemos pra mp3 pra UI tocar
 * cross-browser).
 *
 * Para sticker, deriva a extensão do path da URL retornada (`.webp` na
 * maioria dos casos). Para imagem/documento/video, usa o `content-type`
 * do response ou cai pra `.jpg`/`.bin`.
 */
export function buildUazapiDownloadInboundMedia(
  token: string,
  baseUrl?: string,
): DownloadInboundMedia {
  return async function uazapiDownloadInboundMedia(
    canonical: CanonicalInboundMedia,
  ): Promise<InboundMediaUpload | null> {
    try {
      const downloadPayload = {
        id: canonical.externalMessageId,
        return_base64: false,
        ...(canonical.kind === "audio" ? { generate_mp3: true } : {}),
      };
      const downloaded = await downloadFile({
        token,
        baseUrl: baseUrl ?? process.env.NEXT_PUBLIC_UAZAPI_BASE_URL,
        data: downloadPayload,
      });
      if (!downloaded?.fileURL) return null;

      const mediaResponse = await fetch(downloaded.fileURL, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!mediaResponse.ok) return null;

      const arrayBuffer = await mediaResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Resolve mimetype com prioridade:
      //  1. content-type do response HTTP (autoritativo)
      //  2. Uazapi response (`downloaded.mimetype`)
      //  3. Canônico (vem do webhook)
      const headerMimetype = mediaResponse.headers.get("content-type");
      const mimetype =
        headerMimetype ||
        downloaded.mimetype ||
        canonical.mimetype ||
        defaultMimetypeForKind(canonical.kind);

      // Extensão segue o mesmo critério do route.ts antigo: pra
      // documento/sticker, pega do path da URL (mais confiável que o
      // mimetype genérico); pra imagem/audio/video, do mimetype.
      const extension = pickExtension(
        canonical.kind,
        downloaded.fileURL,
        mimetype,
      );
      const key = `${uuidv4()}.${extension}`;

      await S3.send(
        new PutObjectCommand({
          Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
          Key: key,
          Body: buffer,
          ContentType: mimetype,
        }),
      );

      return {
        key,
        mimetype,
        fileName: canonical.fileName ?? null,
      };
    } catch (error) {
      console.error("[uazapi-strategies] download_media_failed", error);
      return null;
    }
  };
}

function defaultMimetypeForKind(kind: CanonicalInboundMedia["kind"]): string {
  switch (kind) {
    case "image":
      return "image/jpeg";
    case "audio":
      return "audio/mpeg";
    case "video":
      return "video/mp4";
    case "document":
      return "application/octet-stream";
    case "sticker":
      return "image/webp";
  }
}

function pickExtension(
  kind: CanonicalInboundMedia["kind"],
  fileURL: string,
  mimetype: string,
): string {
  if (kind === "document" || kind === "sticker") {
    const fromUrl = fileURL.split(".").pop();
    if (fromUrl && fromUrl.length <= 5) return fromUrl;
  }
  const fromMime = mimetype.split("/")[1];
  if (fromMime) return fromMime.split(";")[0].trim();
  // Fallbacks finais por kind — paridade com `route.ts` pré-Fase 3, que
  // usava "pdf" pra documentos (linha 605 do antigo) e "webp" pra stickers.
  switch (kind) {
    case "document":
      return "pdf";
    case "sticker":
      return "webp";
    case "image":
      return "jpg";
    case "audio":
      return "mp3";
    case "video":
      return "mp4";
  }
}
