import { MessageStatus } from "@/features/tracking-chat/types";
import { sendContact } from "@/http/uazapi/send-contact";
import prisma from "@/lib/prisma";
import z from "zod";
import type { ContactPayload } from "./build-payload";
import {
  MESSAGE_SELECT,
  type ForwardContext,
  type ForwardedMessage,
  type ForwardStrategy,
} from "./types";

export const contactSchema = z.object({
  kind: z.literal("contact"),
  contactName: z.string().min(1),
  contactPhone: z.string().min(1),
});

export const contactStrategy: ForwardStrategy<ContactPayload> = {
  kind: "contact",
  schema: contactSchema,
  async execute(payload, ctx) {
    const response = await sendContact(ctx.token, {
      number: ctx.number,
      fullName: payload.contactName,
      phoneNumber: payload.contactPhone,
      readchat: true,
      readmessages: true,
    });
    const message = await prisma.message.create({
      data: {
        conversationId: ctx.conversationId,
        body: payload.contactName,
        messageId: response.messageid,
        fromMe: true,
        status: MessageStatus.SENT,
        senderName: ctx.senderName,
        mediaType: "contact",
        fileName: payload.contactPhone,
      },
      select: MESSAGE_SELECT,
    });
    return message as ForwardedMessage;
  },
};
