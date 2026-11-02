import "server-only";

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { S3 } from "@/lib/s3-client";
import prisma from "@/lib/prisma";
import { listInstagramMedia } from "@/http/meta/ads-builder";
import { parseInstagramShortcode } from "@/features/trafego/lib/creative-review/schema";
import { resolveOrderMetaAccess } from "./meta/order-meta-access";
import { buildMetaReadCacheKey, readThroughMetaCache } from "./meta/meta-read-cache";
import type { CreativeFrame } from "./creative-review";

/** De onde vêm as imagens que o Astro analisa (spec 0126, RF-9/RF-10, D-6). */

const MAX_FRAME_BYTES = 8 * 1024 * 1024;
/** A URL vem da Graph, nunca do cliente; mesmo assim só baixamos do CDN da Meta. */
const META_CDN_HOST_SUFFIXES = [".cdninstagram.com", ".fbcdn.net"];

function toFrameMediaType(contentType: string | null | undefined): CreativeFrame["mediaType"] {
  if (contentType?.includes("png")) return "image/png";
  if (contentType?.includes("webp")) return "image/webp";
  return "image/jpeg";
}

export interface ResolvedInstagramPost {
  mediaId: string;
  mediaType: string;
  previewUrl: string;
  permalink: string;
  caption: string | null;
}

/** Acha o post entre as publicações das páginas conectadas da org; post de terceiros é recusado (CA-8). */
export async function resolveOrgInstagramPost(
  organizationId: string,
  link: string,
): Promise<{ ok: true; post: ResolvedInstagramPost } | { ok: false; message: string }> {
  const shortcode = parseInstagramShortcode(link);
  if (!shortcode) {
    return { ok: false, message: "Cole o link de um post do Instagram (instagram.com/p/… ou /reel/…), ou envie o arquivo." };
  }

  const access = await resolveOrderMetaAccess({ organizationId });
  if (access.mode !== "account") {
    return { ok: false, message: "Para usar o link, a conta da Meta precisa estar conectada. Envie o arquivo." };
  }

  const integration = await prisma.platformIntegration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "META" } },
    select: { config: true },
  });
  const config = (integration?.config ?? null) as { connectionCheck?: { pages?: { instagramUserId?: string | null }[] } } | null;
  const instagramUserIds = [
    ...new Set((config?.connectionCheck?.pages ?? []).map((page) => page.instagramUserId).filter(Boolean) as string[]),
  ];

  for (const instagramUserId of instagramUserIds) {
    const media = await readThroughMetaCache(
      buildMetaReadCacheKey({ block: "ig-media-review", org: organizationId, ig: instagramUserId }),
      () => listInstagramMedia(access.auth, instagramUserId, { maxPages: 4 }),
    ).catch(() => null);
    const match = media?.items.find((item) => item.permalink?.includes(`/${shortcode}`));
    if (match?.previewUrl && match.permalink) {
      return {
        ok: true,
        post: {
          mediaId: match.id,
          mediaType: match.mediaType,
          previewUrl: match.previewUrl,
          permalink: match.permalink,
          caption: match.caption,
        },
      };
    }
  }
  return {
    ok: false,
    message: "Esse post não está entre as publicações do Instagram conectado à sua conta. Envie o arquivo.",
  };
}

export async function fetchMetaCdnFrame(url: string): Promise<CreativeFrame | null> {
  const host = new URL(url).hostname.toLowerCase();
  if (!META_CDN_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return null;
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_FRAME_BYTES) return null;
  return { mediaType: toFrameMediaType(response.headers.get("content-type")), base64: Buffer.from(bytes).toString("base64") };
}

/** Imagem já guardada de um criativo do pedido (a posse foi conferida antes). */
export async function loadStoredImageFrame(fileKey: string, mimeType: string | null): Promise<CreativeFrame | null> {
  const object = await S3.send(new GetObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: fileKey }));
  if (!object.Body) return null;
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_FRAME_BYTES) return null;
    chunks.push(chunk);
  }
  return {
    mediaType: toFrameMediaType(object.ContentType ?? mimeType),
    base64: Buffer.concat(chunks).toString("base64"),
  };
}
