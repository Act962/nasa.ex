import { type NextRequest, NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";
import prisma from "@/lib/prisma";
import { LeadSource } from "@/generated/prisma/enums";
import { downloadFile } from "@/http/uazapi/get-file";
import { S3 } from "@/lib/s3-client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

// Endpoint: https://neglectful-berta-preconceptional.ngrok-free.dev/api/chat/webhook?trackingId=cmjmw5z3q0000t0vamxz21061
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trackingId = searchParams.get("trackingId");

  if (!trackingId) {
    return NextResponse.json(
      { error: "trackingId is required" },
      { status: 400 },
    );
  }

  try {
    const json = await request.json();

    if (json.EventType === "messages") {
      const fromMe = json.message.fromMe;
      const remoteJid = json.chat.wa_chatid || json.chat.id;
      const name = fromMe ? json.chat.name : json.message.senderName;

      const phone = json.chat.phone.replace(/\D/g, "");

      const status = await prisma.status.findFirst({
        where: { trackingId },
      });

      if (!status) {
        return NextResponse.json(
          { error: "Status context not found" },
          { status: 400 },
        );
      }

      const lead = await prisma.lead.upsert({
        where: {
          phone_trackingId: { phone, trackingId },
        },
        create: {
          statusId: status.id,
          name,
          phone,
          trackingId,
          source: LeadSource.WHATSAPP,
        },
        update: { name },
      });

      const conversation = await prisma.conversation.upsert({
        where: {
          leadId_trackingId: {
            leadId: lead.id,
            trackingId,
          },
        },
        update: {},
        create: {
          leadId: lead.id,
          remoteJid,
          trackingId,
          isActive: true,
        },
      });

      const senderId = fromMe ? json.owner : phone;
      const messageId = json.message.id;
      const messageType = json.message.messageType;

      let body = json.message.text || "";
      if (!body && typeof json.message.content === "string") {
        body = json.message.content;
      } else if (!body && typeof json.message.content === "object") {
        body = json.message.content?.text || "";
      }

      let messageData: any = null;

      if (
        messageType === "ExtendedTextMessage" ||
        messageType === "Conversation"
      ) {
        messageData = await prisma.message.create({
          data: {
            fromMe,
            conversationId: conversation.id,
            senderId,
            messageId,
            body,
          },
          include: {
            conversation: {
              include: { lead: true },
            },
          },
        });
      } else if (messageType === "ImageMessage") {
        const image = await downloadFile({
          token: json.token,
          baseUrl: process.env.NEXT_PUBLIC_UAZAPI_BASE_URL,
          data: { id: messageId, return_base64: false },
        });

        let key = null;
        if (image?.fileURL) {
          try {
            const imageResponse = await fetch(image.fileURL);
            if (imageResponse.ok) {
              const arrayBuffer = await imageResponse.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              const contentType =
                imageResponse.headers.get("content-type") || "image/jpeg";
              const extension = contentType.split("/")[1] || "jpg";
              key = `${uuidv4()}.${extension}`;

              await S3.send(
                new PutObjectCommand({
                  Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
                  Key: key,
                  Body: buffer,
                  ContentType: contentType,
                }),
              );
            }
          } catch (error) {
            console.error("Error uploading to S3:", error);
          }
        }

        messageData = await prisma.message.create({
          data: {
            body,
            mediaUrl: key,
            fromMe,
            conversationId: conversation.id,
            senderId,
            messageId,
          },
          include: {
            conversation: {
              include: { lead: true },
            },
          },
        });
      }

      if (!messageData) {
        return NextResponse.json(
          { success: true, warning: "Message type not processed" },
          { status: 201 },
        );
      }

      try {
        await pusherServer.trigger(conversation.id, "message:new", messageData);
      } catch (e) {
        console.error("Pusher Error:", e);
      }

      return NextResponse.json({ success: true }, { status: 201 });
    }

    if (json.EventType === "connection") {
      if (json.instance.status === "disconnected") {
        await prisma.whatsAppInstance.deleteMany({
          where: { apiKey: json.token },
        });
      }
      return NextResponse.json({ success: true }, { status: 200 });
    }

    return NextResponse.json({ error: "Event not handled" }, { status: 404 });
  } catch (error: any) {
    console.error("Webhook Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
