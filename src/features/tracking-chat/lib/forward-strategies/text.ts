import { MessageStatus } from "@/features/tracking-chat/types";
import prisma from "@/lib/prisma";
import z from "zod";
import type { TextPayload } from "./build-payload";
import {
  MESSAGE_SELECT,
  type ForwardedMessage,
  type ForwardStrategy,
} from "./types";

export const textSchema = z.object({
  kind: z.literal("text"),
  body: z.string().min(1),
});

export const textStrategy: ForwardStrategy<TextPayload> = {
  kind: "text",
  schema: textSchema,
  async execute(payload, ctx) {
    const response = await ctx.provider.sendText({
      kind: "text",
      to: ctx.number,
      body: payload.body,
    });
    const message = await prisma.message.create({
      data: {
        conversationId: ctx.conversationId,
        body: payload.body,
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
