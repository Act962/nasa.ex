import "server-only";
import prisma from "@/lib/prisma";
import type { InstagramMediaCard } from "../../lib/instagram-message-metadata";

/** Consultas à Graph API (token de página) para montar a conversa do Instagram. Falha vira null, nunca erro. */

const FACEBOOK_GRAPH = process.env.META_GRAPH_BASE_URL ?? "https://graph.facebook.com/v21.0";
const REQUEST_TIMEOUT_MS = 8_000;

async function getGraph<T>(path: string, accessToken: string): Promise<T | null> {
  try {
    const separator = path.includes("?") ? "&" : "?";
    const response = await fetch(`${FACEBOOK_GRAPH}${path}${separator}access_token=${encodeURIComponent(accessToken)}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function toMediaType(mediaType?: string, productType?: string): InstagramMediaCard["mediaType"] {
  if (productType === "REELS") return "REEL";
  if (productType === "STORY") return "STORY";
  if (mediaType === "CAROUSEL_ALBUM") return "CAROUSEL";
  if (mediaType === "IMAGE" || mediaType === "VIDEO") return "FEED";
  return "OTHER";
}

export async function fetchInstagramMediaCard(mediaId: string, accessToken: string): Promise<InstagramMediaCard | null> {
  const media = await getGraph<{
    id: string;
    permalink?: string;
    media_type?: string;
    media_product_type?: string;
    thumbnail_url?: string;
    media_url?: string;
    caption?: string;
    timestamp?: string;
  }>(`/${mediaId}?fields=id,permalink,media_type,media_product_type,thumbnail_url,media_url,caption,timestamp`, accessToken);
  if (!media) return null;

  const plannerPost = await prisma.nasaPlannerPost.findFirst({ where: { externalIgPostId: mediaId }, select: { title: true } });
  const caption = media.caption?.split("\n")[0]?.slice(0, 60) ?? null;
  return {
    id: media.id,
    permalink: media.permalink ?? null,
    // Vídeo traz a capa em `thumbnail_url`; foto só em `media_url`.
    thumbnailUrl: media.thumbnail_url ?? (media.media_type === "VIDEO" ? null : (media.media_url ?? null)),
    mediaType: toMediaType(media.media_type, media.media_product_type),
    title: plannerPost?.title ?? caption,
    publishedAt: media.timestamp ?? null,
  };
}

export async function fetchInstagramUserProfile(igScopedUserId: string, accessToken: string) {
  return getGraph<{ name?: string; username?: string; profile_pic?: string }>(`/${igScopedUserId}?fields=name,username,profile_pic`, accessToken);
}
