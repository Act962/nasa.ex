import { type NextRequest, NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";
import prisma from "@/lib/prisma";
import { LeadSource, WhatsAppInstanceStatus } from "@/generated/prisma/enums";
import { downloadFile } from "@/http/uazapi/get-file";
import { S3 } from "@/lib/s3-client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { MessageStatus } from "@/features/tracking-chat/types";
import { getContactDetails } from "@/http/uazapi/get-contact-details";
import { WA_COLORS } from "@/utils/whatsapp-utils";

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
        select: {
          id: true,
        },
      });

      const tracking = await prisma.tracking.findUnique({
        where: { id: trackingId },
        select: {
          id: true,
          globalAiActive: true,
        },
      });

      if (!tracking) {
        return NextResponse.json(
          { error: "Tracking context not found" },
          { status: 400 },
        );
      }

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
            order: 0,
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
      const messageTimestamp = json.message.messageTimestamp;
      const createdAt = messageTimestamp
        ? new Date(messageTimestamp)
        : new Date();

      let body = json.message.text || "";
      if (!body && typeof json.message.content === "string") {
        body = json.message.content;
      } else if (!body && typeof json.message.content.text === "string") {
        body = json.message.content?.text || "";
      } else if (!body && typeof json.message.content.caption === "string") {
        body = json.message.content?.caption || "";
      }

      body = fromMe ? `*${name}*\n${body}` : body;

      let messageData: any = null;
      const quotedMessage = json.message.quoted;
      const messageEdited = json.message.edited;

      let quotedMessageData = null;
      let editedMessageData = null;

      if (quotedMessage) {
        quotedMessageData =
          (await prisma.message.findUnique({
            where: {
              messageId: quotedMessage,
            },
          })) || null;
      }

      if (messageEdited) {
        editedMessageData =
          (await prisma.message.findUnique({
            where: {
              messageId: messageEdited,
            },
            select: {
              id: true,
              body: true,
              messageId: true,
            },
          })) || null;
      }

      if (
        messageType === "ExtendedTextMessage" ||
        messageType === "Conversation"
      ) {
        messageData = await prisma.message.upsert({
          where: { messageId: editedMessageData?.messageId || messageId },
          update: {
            status: MessageStatus.SEEN,
            body: body || editedMessageData?.body,
            createdAt,
          },
          create: {
            fromMe,
            conversationId: lead.conversation?.id!,
            senderId,
            messageId,
            body,
            status: MessageStatus.SEEN,
            quotedMessageId: quotedMessageData?.id,
            createdAt,
            senderName: name,
          },
          include: {
            quotedMessage: true,
            conversation: {
              include: { lead: true, lastMessage: true },
            },
          },
        });

        if (lead.isActive && tracking.globalAiActive) {
          await fetch("https://n8n.nasaex.com/webhook/ai-nasa", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: "MESSAGE",
              text: body,
              phone: lead.phone,
              trackingId,
              leadId: lead.id,
            }),
          });
        }
      }

      if (messageType === "ImageMessage") {
        let key = null;
        let mimetype = "";
        if (!editedMessageData) {
          const image = await downloadFile({
            token: json.token,
            baseUrl: process.env.NEXT_PUBLIC_UAZAPI_BASE_URL,
            data: { id: messageId, return_base64: false },
          });

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
        }

        messageData = await prisma.message.upsert({
          where: { messageId: editedMessageData?.messageId || messageId },
          update: {
            status: MessageStatus.SEEN,
            body: body || editedMessageData?.body,
            createdAt,
          },
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
            createdAt,
            senderName: name,
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
        let key = null;
        let mimetype = null;

        if (!editedMessageData) {
          const document = await downloadFile({
            token: json.token,
            baseUrl: process.env.NEXT_PUBLIC_UAZAPI_BASE_URL,
            data: { id: messageId, return_base64: false },
          });

          mimetype = document.mimetype;

          if (document?.fileURL) {
            const documentResponse = await fetch(document.fileURL);
            if (documentResponse.ok) {
              const arrayBuffer = await documentResponse.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);

              const extension = document.fileURL.split(".").pop() || "pdf";
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
        }
        messageData = await prisma.message.upsert({
          where: { messageId: editedMessageData?.messageId || messageId },
          update: {
            status: MessageStatus.SEEN,
            body: body || editedMessageData?.body,
            createdAt,
          },
          create: {
            body,
            mediaUrl: key,
            fileName: json.message.content.fileName,
            fromMe,
            mimetype,
            status: MessageStatus.SEEN,
            quotedMessageId: quotedMessageData?.id,
            conversationId: lead.conversation?.id!,
            senderId,
            senderName: name,
            messageId,
            createdAt,
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
            senderName: name,
            messageId,
            createdAt,
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
        if (document?.fileURL) {
          const documentResponse = await fetch(document.fileURL);
          if (documentResponse.ok) {
            const arrayBuffer = await documentResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const extension = document.fileURL.split(".").pop() || "webp";
            key = `${uuidv4()}.${extension}`;

            await S3.send(
              new PutObjectCommand({
                Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
                Key: key,
                Body: buffer,
                ContentType: document.mimetype,
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
            mimetype: document.mimetype,
            senderId,
            senderName: name,
            messageId,
            createdAt,
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
        await prisma.whatsAppInstance.update({
          where: { apiKey: json.token },
          data: {
            status: WhatsAppInstanceStatus.DISCONNECTED,
          },
        });
      }
      return NextResponse.json({ success: true }, { status: 200 });
    }
    if (json.EventType === "labels") {
      const { LabelID, Action } = json.event;

      if (Action) {
        const tracking = await prisma.tracking.findUnique({
          where: { id: trackingId },
          select: { organizationId: true },
        });

        if (!tracking) {
          return NextResponse.json({ success: true }, { status: 200 });
        }

        const whatsappId = `${LabelID}`;

        const colorHex =
          Action.color !== undefined
            ? WA_COLORS[Action.color] || WA_COLORS[0]
            : WA_COLORS[0];

        if (Action.deleted) {
          await prisma.tag.updateMany({
            where: {
              whatsappId: LabelID,
              organizationId: tracking.organizationId,
            },
            data: {
              whatsappId: null,
            },
          });
        } else {
          const existingTag = await prisma.tag.findFirst({
            where: {
              whatsappId,
              organizationId: tracking.organizationId,
            },
          });

          if (existingTag) {
            await prisma.tag.update({
              where: { id: existingTag.id },
              data: {
                name: Action.name,
                color: colorHex,
              },
            });
          } else {
            // Verifica se já existe uma tag com o mesmo nome para evitar violação do unique constraint
            await prisma.tag.upsert({
              where: {
                name_organizationId_trackingId: {
                  name: Action.name,
                  organizationId: tracking.organizationId,
                  trackingId,
                },
              },
              update: {
                whatsappId,
                color: colorHex,
              },
              create: {
                name: Action.name,
                color: colorHex,
                whatsappId,
                organizationId: tracking.organizationId,
                trackingId,
                slug: `${Action.name.toLowerCase().replace(/\s/g, "_")}-${whatsappId}`,
              },
            });
          }
        }
      }
      return NextResponse.json({ success: true }, { status: 200 });
    }
    if (json.EventType === "chat_labels") {
      const remoteJid = json.chat.wa_chatid || json.chat.id;
      const labels = (json.chat.wa_label as string[]) || [];

      const conversation = await prisma.conversation.findFirst({
        where: {
          remoteJid,
          trackingId,
        },
        select: {
          leadId: true,
        },
      });

      if (conversation?.leadId) {
        const whatsappLabelIds = labels
          .map((l) => l.split(":").pop())
          .filter(Boolean) as string[];

        const tags = await prisma.tag.findMany({
          where: {
            whatsappId: { in: whatsappLabelIds },
            trackingId,
          },
          select: { id: true },
        });

        const tagIds = tags.map((t) => t.id);

        await prisma.leadTag.deleteMany({
          where: { leadId: conversation.leadId },
        });

        if (tagIds.length > 0) {
          await prisma.leadTag.createMany({
            data: tagIds.map((tagId) => ({
              leadId: conversation.leadId,
              tagId,
            })),
            skipDuplicates: true,
          });
        }

        await pusherServer.trigger(trackingId, "lead:updated", {
          leadId: conversation.leadId,
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
