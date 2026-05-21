import { MessageStatus } from "@/features/tracking-chat/types";
import { inferUazapiMediaType } from "@/features/tracking-chat/utils/uazapi-media-type";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { sendMedia } from "@/http/uazapi/send-media";
import prisma from "@/lib/prisma";
import { S3 } from "@/lib/s3-client";
import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import z from "zod";
import type { MediaPayload } from "./build-payload";
import {
  MESSAGE_SELECT,
  type ForwardContext,
  type ForwardedMessage,
  type ForwardStrategy,
} from "./types";

function buildForwardKey(originalKey: string, fileName?: string | null): string {
  const source = fileName || originalKey;
  const ext = source.includes(".") ? source.split(".").pop() : "bin";
  return `${uuidv4()}.${ext}`;
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
    const uazapiType = inferUazapiMediaType({
      mediaType: payload.mediaType,
      mimetype: payload.mimetype,
      fileName: payload.fileName,
    });

    if (!uazapiType) throw new Error("Could not determine media type for forwarding");

    const newMediaKey = buildForwardKey(payload.mediaUrl, payload.fileName);

    await S3.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: encodeURI(`${bucket}/${payload.mediaUrl}`),
        Key: newMediaKey,
        MetadataDirective: "COPY",
      }),
    );

    const response = await sendMedia(ctx.token, {
      number: ctx.number,
      type: uazapiType,
      file: useConstructUrl(newMediaKey),
      text: payload.body?.trim() || undefined,
      docName: uazapiType === "document" ? payload.fileName ?? undefined : undefined,
      mimetype: payload.mimetype,
      readchat: true,
      readmessages: true,
    });

    const message = await prisma.message.create({
      data: {
        conversationId: ctx.conversationId,
        body: payload.body?.trim() ? payload.body : null,
        mediaUrl: newMediaKey,
        mediaType: payload.mediaType ?? null,
        mimetype: payload.mimetype ?? null,
        fileName: payload.fileName ?? null,
        messageId: response.messageid,
        fromMe: true,
        status: MessageStatus.SENT,
        senderName: ctx.senderName,
      },
      select: MESSAGE_SELECT,
    });
    return message as ForwardedMessage;
  },
};
