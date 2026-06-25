import { MessageStatus } from "@/features/tracking-chat/types";
import prisma from "@/lib/prisma";
import z from "zod";
import type { LocationPayload } from "./build-payload";
import {
  MESSAGE_SELECT,
  type ForwardedMessage,
  type ForwardStrategy,
} from "./types";

export const locationSchema = z.object({
  kind: z.literal("location"),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  name: z.string().optional(),
  address: z.string().optional(),
});

export const locationStrategy: ForwardStrategy<LocationPayload> = {
  kind: "location",
  schema: locationSchema,
  async execute(payload, ctx) {
    const response = await ctx.provider.sendLocation({
      kind: "location",
      to: ctx.number,
      latitude: payload.latitude,
      longitude: payload.longitude,
      name: payload.name,
      address: payload.address,
    });
    const bodyText =
      [payload.name, payload.address].filter(Boolean).join(" — ") || null;
    const message = await prisma.message.create({
      data: {
        conversationId: ctx.conversationId,
        body: bodyText,
        messageId: response.externalMessageId,
        fromMe: true,
        status: MessageStatus.SEEN,
        senderName: ctx.senderName,
        mediaType: "location",
        latitude: payload.latitude,
        longitude: payload.longitude,
      },
      select: MESSAGE_SELECT,
    });
    return message as ForwardedMessage;
  },
};
