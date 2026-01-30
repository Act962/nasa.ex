"use server";

import prisma from "@/lib/prisma";
import { TypeMessage } from "../uazapi/types";

interface messageProps {
  type: TypeMessage;
  senderId: string;
  messageId: string;
  trackingId: string;
  conversationId: string;
  phone: string;
  fromMe: boolean;
  caption?: string;
  body?: string;
}

export async function saveMessage(message: messageProps) {
  switch (message.type) {
    case "ExtendedTextMessage":
      return await saveTextMessage(message);
    case "Conversation":
      return await saveTextMessage(message);
    case "ImageMessage":
      return await saveImageMessage(message);
    default:
      return null;
  }
}

export async function saveTextMessage({
  senderId,
  messageId,
  trackingId,
  conversationId,
  phone,
  fromMe = false,
  body,
}: {
  senderId: string;
  messageId: string;
  trackingId: string;
  conversationId: string;
  phone: string;
  fromMe: boolean;
  body?: string;
  type: TypeMessage;
}) {
  try {
    const message = await prisma.message.create({
      data: {
        fromMe: fromMe,
        conversationId: conversationId,
        senderId: senderId,
        messageId: messageId,
        body: body,
      },
      include: {
        conversation: {
          include: {
            lead: true,
          },
        },
      },
    });
    return message;
  } catch (e) {
    console.log(e);
    throw e;
  }
}

export async function saveImageMessage({
  caption,
  senderId,
  messageId,
  trackingId,
  conversationId,
  phone,
  fromMe = false,
}: {
  caption?: string;
  senderId: string;
  messageId: string;
  trackingId: string;
  conversationId: string;
  phone: string;
  fromMe: boolean;
}) {
  try {
    const message = await prisma.message.create({
      data: {
        body: caption,
        fromMe: fromMe,
        conversationId: conversationId,
        senderId: senderId,
        messageId: messageId,
      },
      include: {
        conversation: {
          include: {
            lead: true,
          },
        },
      },
    });
    return message;
  } catch (e) {
    console.log(e);
  }
}
