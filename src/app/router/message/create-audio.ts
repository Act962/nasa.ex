import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { CreatedMessageProps } from "@/features/tracking-chat/types";
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
        delay: 2000,
        type: "myaudio",
        readchat: true,
        readmessages: true,
      });

      const message = await prisma.message.create({
        data: {
          conversationId: input.conversationId,
          mediaUrl: input.nameAudio,
          mimetype: input.mimetype,
          messageId: response.id,
          fromMe: true,
          fileName: input.nameAudio,
        },
        include: {
          conversation: {
            include: {
              lead: true,
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
        message: {
          id: message.id,
          body: message.body,
          createdAt: message.createdAt,
          fromMe: true,
          mediaUrl: message.mediaUrl,
          mimetype: message.mimetype,
          fileName: message.fileName,
          conversation: {
            lead: {
              id: message.conversation.lead.id,
              name: message.conversation.lead.name,
            },
          },
        },
      };
    } catch (e) {
      console.log(e);
      throw e;
    }
  });
