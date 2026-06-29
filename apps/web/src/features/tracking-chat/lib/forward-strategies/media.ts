import { MessageStatus } from "@/features/tracking-chat/types";
import { useConstructUrl } from "@/hooks/use-construct-url";
import prisma from "@/lib/prisma";
import { S3 } from "@/lib/s3-client";
import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import z from "zod";
import type { MediaPayload } from "./build-payload";
import type { CanonicalMediaKind } from "@/features/tracking-chat/lib/providers";
import {
  MESSAGE_SELECT,
  type ForwardedMessage,
  type ForwardStrategy,
} from "./types";

function buildForwardKey(
  originalKey: string,
  fileName?: string | null,
): string {
  const source = fileName || originalKey;
  const ext = source.includes(".") ? source.split(".").pop() : "bin";
  return `${uuidv4()}.${ext}`;
}

/**
 * Infere o `CanonicalMediaKind` (PORT) a partir dos hints disponíveis.
 * Substitui `inferUazapiMediaType` que devolvia `MediaType` Uazapi-only
 * (incluía o variante `myaudio`). Tradução pra Uazapi/Meta acontece nos
 * próprios adapters.
 */
function inferMediaKind(args: {
  mediaType?: string | null;
  mimetype?: string | null;
}): CanonicalMediaKind | null {
  const { mediaType, mimetype } = args;
  if (mediaType === "image" || mimetype?.startsWith("image/")) return "image";
  if (mediaType === "video" || mimetype?.startsWith("video/")) return "video";
  if (mediaType === "audio" || mimetype?.startsWith("audio/")) return "audio";
  if (mediaType === "sticker") return "sticker";
  if (mediaType === "document" || mimetype) return "document";
  return null;
}

export const mediaSchema = z.object({
  kind: z.literal("media"),
  mediaUrl: z.string(),
  mediaType: z.string().optional(),
  mimetype: z.string().optional(),
  fileName: z.string().optional(),
  body: z.string().optional(),
});

export const mediaStrategy: ForwardStrategy<MediaPayload> = {
  kind: "media",
  schema: mediaSchema,
  async execute(payload, ctx) {
    const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!;
    const mediaKind = inferMediaKind({
      mediaType: payload.mediaType,
      mimetype: payload.mimetype,
    });

    if (!mediaKind)
      throw new Error("Could not determine media type for forwarding");

    const newMediaKey = buildForwardKey(payload.mediaUrl, payload.fileName);

    await S3.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: encodeURI(`${bucket}/${payload.mediaUrl}`),
        Key: newMediaKey,
        MetadataDirective: "COPY",
      }),
    );

    const response = await ctx.provider.sendMedia({
      kind: "media",
      mediaKind,
      to: ctx.number,
      mediaUrl: useConstructUrl(newMediaKey),
      caption: payload.body?.trim() || undefined,
      fileName: mediaKind === "document" ? payload.fileName : undefined,
      mimetype: payload.mimetype,
    });

    const message = await prisma.message.create({
      data: {
        conversationId: ctx.conversationId,
        body: payload.body?.trim() ? payload.body : null,
        mediaUrl: newMediaKey,
        mediaType: payload.mediaType ?? null,
        mimetype: payload.mimetype ?? null,
        fileName: payload.fileName ?? null,
        messageId: response.externalMessageId,
        fromMe: true,
        status: MessageStatus.SEEN,
        senderName: ctx.senderName,
      },
      select: MESSAGE_SELECT,
    });
    return message as ForwardedMessage;
  },
};
