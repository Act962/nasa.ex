import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import {
  CreatedMessageProps,
  MessageStatus,
} from "@/features/tracking-chat/types";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { sendMedia } from "@/http/uazapi/send-media";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { S3 } from "@/lib/s3-client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import z from "zod";

export const createMessageWithAudio = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/message/create-with-audio",
    summary: "Create message with audio",
  })
  .input(
    z.object({
      conversationId: z.string(),
      leadPhone: z.string(),
      token: z.string(),
      blob: z.instanceof(Blob),
      nameAudio: z.string(),
      mimetype: z.string(),
      replyId: z.string().optional(),
      id: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      const buffer = Buffer.from(await input.blob.arrayBuffer());

      const presignedResponse = await S3.send(
        new PutObjectCommand({
          Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
          Key: input.nameAudio,
          Body: buffer,
          ContentType: input.mimetype,
        }),
      );

      if (!presignedResponse) {
        throw new Error("Falha ao gerar URL presignada");
      }

      const response = await sendMedia(input.token, {
        file: useConstructUrl(input.nameAudio),
        number: input.leadPhone,
        type: "myaudio",
        readchat: true,
        readmessages: true,
        replyid: input.replyId,
      });

      const message = await prisma.message.create({
        data: {
          conversationId: input.conversationId,
          mediaUrl: input.nameAudio,
          mimetype: input.mimetype,
          messageId: response.messageid,
          fromMe: true,
          fileName: input.nameAudio,
          status: MessageStatus.SENT,
          quotedMessageId: input.id,
          senderName: context.user.name,
        },
        select: {
          id: true,
          messageId: true,
          body: true,
          createdAt: true,
          fromMe: true,
          status: true,
          mediaUrl: true,
          mediaType: true,
          mediaCaption: true,
          mimetype: true,
          fileName: true,
          quotedMessageId: true,
          conversationId: true,
          senderId: true,
          conversation: {
            select: {
              id: true,
              lead: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          quotedMessage: {
            include: {
              conversation: {
                include: {
                  lead: true,
                },
              },
            },
          },
        },
      });

      const messageCreated: CreatedMessageProps = {
        ...message,
        currentUserId: context.user.id,
      };

      await pusherServer.trigger(
        message.conversationId,
        "message:created",
        messageCreated,
      );

      return {
        message,
      };
    } catch (e) {
      console.log(e);
      throw e;
    }
  });
