"use server";

import prisma from "@/lib/prisma";
import { TypeMessage, UploadedFile } from "../uazapi/types";
import { downloadFile } from "../uazapi/get-file";
import { uazapiFetch } from "../uazapi/client";
import { S3 } from "@/lib/s3-client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

interface messageProps {
  type: TypeMessage;
  senderId: string;
  trackingId: string;
  conversationId: string;
  phone: string;
  fromMe: boolean;
  caption?: string;
  body?: string;
  mediaUrl?: string;
  token: string;
  id: string;
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
  trackingId,
  conversationId,
  phone,
  fromMe = false,
  body,
  id,
}: {
  senderId: string;
  trackingId: string;
  conversationId: string;
  phone: string;
  fromMe: boolean;
  body?: string;
  type: TypeMessage;
  id: string;
}) {
  try {
    const message = await prisma.message.create({
      data: {
        fromMe: fromMe,
        conversationId: conversationId,
        senderId: senderId,
        messageId: id,
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
  body,
  senderId,
  trackingId,
  conversationId,
  phone,
  mediaUrl,
  token,
  fromMe = false,
  id,
}: {
  body?: string;
  senderId: string;
  trackingId: string;
  conversationId: string;
  phone: string;
  fromMe: boolean;
  mediaUrl?: string;
  token: string;
  id: string;
}) {
  try {
    const image = await downloadFile({
      token,
      baseUrl: process.env.NEXT_PUBLIC_UAZAPI_BASE_URL,
      data: {
        id: id,
        return_base64: false,
      },
    });

    if (!image.fileURL) {
      return null;
    }

    const imageResponse = await fetch(image.fileURL);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image from ${image.fileURL}`);
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType =
      imageResponse.headers.get("content-type") || "image/jpeg";
    const extension = contentType.split("/")[1] || "jpg";
    const key = `${uuidv4()}.${extension}`;

    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await S3.send(uploadCommand);

    const message = await prisma.message.create({
      data: {
        body: body,
        mediaUrl: key,
        fromMe: fromMe,
        conversationId: conversationId,
        senderId: senderId,
        messageId: id,
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
