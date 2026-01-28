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
      await saveTextMessage(message);
      break;
    case "Conversation":
      await saveTextMessage(message);
      break;
    case "ImageMessage":
      await saveImageMessage(message);
      break;
    default:
      break;
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
    await prisma.message.create({
      data: {
        fromMe: fromMe,
        conversationId: conversationId,
        senderId: senderId,
        messageId: messageId,
        body: body,
      },
    });
  } catch (e) {
    console.log(e);
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
    await prisma.message.create({
      data: {
        body: caption,
        fromMe: fromMe,
        conversationId: conversationId,
        senderId: senderId,
        messageId: messageId,
      },
    });
  } catch (e) {
    console.log(e);
  }
}
