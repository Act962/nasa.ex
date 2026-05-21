import { MessageStatus } from "@/features/tracking-chat/types";
import { sendText } from "@/http/uazapi/send-text";
import prisma from "@/lib/prisma";
import z from "zod";
import type { TextPayload } from "./build-payload";
import {
  MESSAGE_SELECT,
  type ForwardContext,
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
    const response = await sendText(ctx.token, {
      text: payload.body,
      number: ctx.number,
    });
    const message = await prisma.message.create({
      data: {
        conversationId: ctx.conversationId,
        body: payload.body,
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
