import { type NextRequest, NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";
import prisma from "@/lib/prisma";
import { LeadSource } from "@/generated/prisma/enums";
import { downloadFile } from "@/http/uazapi/get-file";
import { S3 } from "@/lib/s3-client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { MessageStatus } from "@/features/tracking-chat/types";
import { getContactDetails } from "@/http/uazapi/get-contact-details";

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

      let lead = await prisma.lead.findUnique({
        where: {
          phone_trackingId: { phone, trackingId },
        },
        include: {
          conversation: true,
        },
      });

      let key = lead?.profile || null;

      if (!lead) {
        try {
          const profileLead = await getContactDetails({
            token: json.token,
            data: { number: phone as string, preview: false },
          });

          if (profileLead?.image) {
            const imageResponse = await fetch(profileLead.image);
            if (imageResponse.ok) {
              const arrayBuffer = await imageResponse.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              const mimetype =
                imageResponse.headers.get("content-type") || "image/jpeg";

              const extension = mimetype.split("/")[1] || "jpg";
              key = `${uuidv4()}.${extension}`;

              await S3.send(
                new PutObjectCommand({
                  Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
                  Key: key,
                  Body: buffer,
                  ContentType: mimetype,
                }),
              );
            }
          }
        } catch (error) {
          console.error("Error fetching or uploading profile image:", error);
        }
        lead = await prisma.lead.create({
          data: {
            statusId: status.id,
            name,
            phone,
            trackingId,
            source: LeadSource.WHATSAPP,
            profile: key,
            conversation: {
              create: {
                remoteJid,
                trackingId,
                isActive: true,
              },
            },
          },
          include: {
            conversation: true,
          },
        });

        await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/workflows/lead/new?trackingId=${trackingId}&leadId=${lead.id}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ trackingId }),
          },
        );
      } else {
        if (!lead.conversation) {
          await prisma.conversation.create({
            data: {
              remoteJid,
              trackingId,
              isActive: true,
              leadId: lead.id,
            },
          });
        }
      }

      const senderId = fromMe ? json.owner : phone;
      const messageId = json.message.messageid;
      const messageType = json.message.messageType;

      let body = json.message.text || "";
      if (!body && typeof json.message.content === "string") {
        body = json.message.content;
      } else if (!body && typeof json.message.content === "object") {
        body = json.message.content?.text || "";
      }

      let messageData: any = null;
      const quotedMessage = json.message.quoted;

      let quotedMessageData = null;

      if (quotedMessage) {
        quotedMessageData =
          (await prisma.message.findUnique({
            where: {
              messageId: quotedMessage,
            },
          })) || null;
      }

      if (
        messageType === "ExtendedTextMessage" ||
        messageType === "Conversation"
      ) {
        messageData = await prisma.message.upsert({
          where: { messageId },
          update: {
            status: MessageStatus.SEEN,
          },
          create: {
            fromMe,
            conversationId: lead.conversation?.id!,
            senderId,
            messageId,
            body,
            status: MessageStatus.SEEN,
            quotedMessageId: quotedMessageData?.id,
          },
          include: {
            quotedMessage: true,
            conversation: {
              include: { lead: true, lastMessage: true },
            },
          },
        });
      }

      if (messageType === "ImageMessage") {
        const image = await downloadFile({
          token: json.token,
          baseUrl: process.env.NEXT_PUBLIC_UAZAPI_BASE_URL,
          data: { id: messageId, return_base64: false },
        });

        let key = null;
        let mimetype = "";
        if (image?.fileURL) {
          try {
            const imageResponse = await fetch(image.fileURL);
            if (imageResponse.ok) {
              const arrayBuffer = await imageResponse.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              mimetype =
                imageResponse.headers.get("content-type") || "image/jpeg";

              const extension = mimetype.split("/")[1] || "jpg";
              key = `${uuidv4()}.${extension}`;

              await S3.send(
                new PutObjectCommand({
                  Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
                  Key: key,
                  Body: buffer,
                  ContentType: mimetype,
                }),
              );
            }
          } catch (error) {
            console.error("Error uploading to S3:", error);
          }
        }

        messageData = await prisma.message.upsert({
          where: { messageId },
          update: {},
          create: {
            body,
            mediaUrl: key,
            fromMe,
            status: MessageStatus.SEEN,
            conversationId: lead.conversation?.id!,
            quotedMessageId: quotedMessageData?.id,
            mimetype,
            senderId,
            messageId,
          },
          include: {
            quotedMessage: true,
            conversation: {
              include: { lead: true },
            },
          },
        });
      }
      if (messageType === "DocumentMessage") {
        const document = await downloadFile({
          token: json.token,
          baseUrl: process.env.NEXT_PUBLIC_UAZAPI_BASE_URL,
          data: { id: messageId, return_base64: false },
        });

        let key = null;
        let mimetype = "";
        if (document?.fileURL) {
          const documentResponse = await fetch(document.fileURL);
          if (documentResponse.ok) {
            const arrayBuffer = await documentResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            mimetype =
              documentResponse.headers.get("content-type") || "application/pdf";

            const extension = mimetype.split("/")[1] || "pdf";
            key = `${uuidv4()}.${extension}`;

            await S3.send(
              new PutObjectCommand({
                Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
                Key: key,
                Body: buffer,
                ContentType: mimetype,
              }),
            );
          }
        }

        messageData = await prisma.message.create({
          data: {
            body,
            mediaUrl: key,
            fileName: json.message.content.fileName,
            fromMe,
            mimetype,
            status: MessageStatus.SEEN,
            quotedMessageId: quotedMessageData?.id,
            conversationId: lead.conversation?.id!,
            senderId,
            messageId,
          },
          include: {
            quotedMessage: true,
            conversation: {
              include: { lead: true },
            },
          },
        });
      }
      if (messageType === "AudioMessage") {
        const audio = await downloadFile({
          token: json.token,
          baseUrl: process.env.NEXT_PUBLIC_UAZAPI_BASE_URL,
          data: { id: messageId, return_base64: false, generate_mp3: true },
        });

        let key = null;
        let mimetype = "";
        if (audio?.fileURL) {
          try {
            const audioResponse = await fetch(audio.fileURL);
            if (audioResponse.ok) {
              const arrayBuffer = await audioResponse.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              mimetype =
                audioResponse.headers.get("content-type") || "audio/mpeg";
              const extension = mimetype.split("/")[1] || "mp3";
              key = `${uuidv4()}.${extension}`;

              await S3.send(
                new PutObjectCommand({
                  Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
                  Key: key,
                  Body: buffer,
                  ContentType: mimetype,
                }),
              );
            }
          } catch (error) {
            console.error("Error uploading to S3:", error);
          }
        }

        messageData = await prisma.message.upsert({
          where: { messageId },
          update: {},
          create: {
            mediaUrl: key,
            fromMe,
            mimetype,
            quotedMessageId: quotedMessageData?.id,
            status: MessageStatus.SEEN,
            conversationId: lead.conversation?.id!,
            senderId,
            messageId,
          },
          include: {
            quotedMessage: true,
            conversation: {
              include: { lead: true },
            },
          },
        });
      }
      if (messageType === "StickerMessage") {
        const document = await downloadFile({
          token: json.token,
          baseUrl: process.env.NEXT_PUBLIC_UAZAPI_BASE_URL,
          data: { id: messageId, return_base64: false },
        });
        let key = null;
        let mimetype = "";
        if (document?.fileURL) {
          const documentResponse = await fetch(document.fileURL);
          if (documentResponse.ok) {
            const arrayBuffer = await documentResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            mimetype =
              documentResponse.headers.get("content-type") ||
              "application/webp";

            const extension = mimetype.split("/")[1] || "webp";
            key = `${uuidv4()}.${extension}`;

            await S3.send(
              new PutObjectCommand({
                Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
                Key: key,
                Body: buffer,
                ContentType: mimetype,
              }),
            );
          }
        }

        messageData = await prisma.message.create({
          data: {
            mediaUrl: key,
            fromMe,
            status: MessageStatus.SEEN,
            conversationId: lead.conversation?.id!,
            quotedMessageId: quotedMessageData?.id,
            mimetype,
            senderId,
            messageId,
          },
          include: {
            quotedMessage: true,
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
      await prisma.conversation.update({
        where: {
          leadId_trackingId: {
            leadId: lead.id,
            trackingId,
          },
        },
        data: {
          lastMessageId: messageData.id,
        },
      });

      await pusherServer.trigger(trackingId, "conversation:new", {
        ...lead.conversation,
        lead,
      });

      await pusherServer.trigger(
        lead.conversation?.id!,
        "message:new",
        messageData,
      );
      await pusherServer.trigger(trackingId, "message:new", messageData);

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
