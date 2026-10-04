import { z } from "zod";

/** `Message.metadata.instagram` (spec 0062): o que veio do Instagram e de qual post. Lido no servidor e na tela. */

export const instagramMediaCardSchema = z.object({
  id: z.string(),
  permalink: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  mediaType: z.enum(["FEED", "REEL", "CAROUSEL", "STORY", "OTHER"]),
  title: z.string().nullable(),
  publishedAt: z.string().nullable(),
});

export const instagramMessageMetadataSchema = z.object({
  kind: z.enum(["COMMENT", "DIRECT_MESSAGE", "COMMENT_REPLY", "AUTOMATION_COMMENT_REPLY", "AUTOMATION_DIRECT_MESSAGE"]),
  commentId: z.string().optional(),
  media: instagramMediaCardSchema.nullable().optional(),
  buttons: z.array(z.object({ title: z.string(), url: z.string() })).optional(),
});

export type InstagramMediaCard = z.infer<typeof instagramMediaCardSchema>;
export type InstagramMessageMetadata = z.infer<typeof instagramMessageMetadataSchema>;

export const INSTAGRAM_MEDIA_TYPE_LABEL: Record<InstagramMediaCard["mediaType"], string> = {
  FEED: "Feed",
  REEL: "Reel",
  CAROUSEL: "Carrossel",
  STORY: "Story",
  OTHER: "Post",
};

export function readInstagramMetadata(metadata: unknown): InstagramMessageMetadata | null {
  const instagram = (metadata as { instagram?: unknown } | null)?.instagram;
  if (!instagram) return null;
  const parsed = instagramMessageMetadataSchema.safeParse(instagram);
  return parsed.success ? parsed.data : null;
}
