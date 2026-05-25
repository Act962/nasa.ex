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
import { assignLeadRoundRobin } from "@/http/rodizio/create-lead";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import {
  resolveReferralForOrg,
  ctwaToLeadData,
  captureMetaReferralForNewLead,
} from "@/lib/lead-journey/ctwa";
import {
  callsEventSchema,
  chatLabelsEventSchema,
  messagesEventSchema,
  webhookBaseSchema,
} from "@/http/uazapi/webhook-schema";
import { inngest } from "@/inngest/client";
import { eventBus } from "@/features/alerts/lib/event-bus";

const FETCH_TIMEOUT_MS = 10_000;

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
    console.log(json);
    const base = webhookBaseSchema.safeParse(json);
    if (!base.success) {
      console.warn("[webhook:chat] invalid_base", {
        trackingId,
        issues: base.error.issues,
      });
      return NextResponse.json(
        { ok: false, reason: "invalid_payload" },
        { status: 400 },
      );
    }

    if (base.data.EventType === "messages") {
      const messagesParsed = messagesEventSchema.safeParse(json);
      if (!messagesParsed.success) {
        console.warn("[webhook:chat] invalid_messages", {
          trackingId,
          issues: messagesParsed.error.issues,
        });
        return NextResponse.json(
          { ok: false, reason: "invalid_messages_payload" },
          { status: 200 },
        );
      }

      const fromMe = json.message.fromMe;
      const name =
        json.message.senderName || json.chat?.name || "Sem nome";

      const phone = json.message.chatid.split("@")[0];
      const remoteJid = json.message.chatid;

      const tracking = await prisma.tracking.findUnique({
        where: { id: trackingId },
        select: {
          id: true,
          organizationId: true,
          globalAiActive: true,
        },
      });

      if (!tracking) {
        return NextResponse.json(
          { error: "Tracking context not found" },
          { status: 400 },
        );
      }

      let lead = await prisma.lead.findUnique({
        where: {
          phone_trackingId: { phone, trackingId },
        },
        include: {
          conversation: true,
          leadTags: {
            include: {
              tag: true,
            },
          },
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
            const imageResponse = await fetch(profileLead.image, {
              signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            });
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

        const status = await prisma.status.findFirst({
          where: { trackingId },
          select: {
            id: true,
          },
          orderBy: {
            order: "asc",
          },
        });

        const firstLead = await prisma.lead.findFirst({
          where: { statusId: status?.id },
          select: {
            order: true,
          },
          orderBy: {
            order: "asc",
          },
        });

        if (!status) {
          return NextResponse.json(
            { error: "Status context not found" },
            { status: 400 },
          );
        }

        const ctwa = await resolveReferralForOrg(
          tracking.organizationId,
          json.message,
          json,
        );

        const createdLead = await prisma.lead.create({
          data: {
            name,
            statusId: status.id,
            phone,
            trackingId: trackingId,
            source: LeadSource.WHATSAPP,
            profile: key,
            order: firstLead ? Number(firstLead.order) - 1 : 0,
            statusFlow: "WAITING",
            lastInboundAt: new Date(),
            ...(ctwa ? ctwaToLeadData(ctwa.ref, ctwa.resolved) : {}),
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
            leadTags: {
              include: {
                tag: true,
              },
            },
          },
        });

        lead = createdLead;

        // `message_in` é logado abaixo no bloco unificado de timestamps;
        // aqui só registramos o referral CTWA pra dar contexto na timeline.
        if (ctwa) {
          await captureMetaReferralForNewLead(
            lead.id,
            ctwa.ref,
            ctwa.resolved,
            "WHATSAPP",
          );
        }

        // Log system activity for new lead via WhatsApp
        try {
          const tracking = await prisma.tracking.findUnique({
            where: { id: trackingId },
            select: { name: true, organizationId: true },
          });
          if (tracking) {
            await logActivity({
              organizationId: tracking.organizationId,
              userId: "system",
              userName: "Sistema",
              userEmail: "sistema@nasa",
              appSlug: "tracking",
              action: "lead.arrived",
              actionLabel: `Um lead chegou no tracking "${tracking.name}" via WhatsApp (${lead.name ?? phone})`,
              resource: lead.name ?? phone,
              resourceId: lead.id,
              metadata: {
                phone,
                trackingName: tracking.name,
                source: "WHATSAPP",
              },
            });
          }
        } catch {}

        try {
          if (lead && lead.id) {
            await prisma.$transaction((tx) =>
              assignLeadRoundRobin(tx, lead?.id || ""),
            );
          }
        } catch (error) {
          console.error("Error assigning lead in round robin:", error);
        }

        try {
          await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/workflows/lead/new?trackingId=${trackingId}&leadId=${lead.id}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ trackingId }),
              signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            },
          );
        } catch (error) {
          console.error("[webhook:chat] workflow_lead_new_failed", error);
        }
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

        if (!fromMe && lead.statusFlow === "FINISHED") {
          lead = await prisma.lead.update({
            where: { id: lead.id },
            data: { statusFlow: "ACTIVE" },
            include: {
              conversation: true,
              leadTags: { include: { tag: true } },
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

      // ── Revoke (mensagem apagada no WhatsApp pelo lead/atendente) ────
      // O uazapi entrega como `messageType: "ProtocolMessage"` com
      // `content.type` indicando REVOKE (geralmente 0 ou "REVOKE" como
      // string). O campo `content.key.id` (ou `content.id`) aponta pra
      // mensagem original que foi revogada. Estratégia idêntica ao
      // soft-delete: marca status=DELETED + limpa body/mídia. UI já
      // renderiza como "Mensagem apagada".
      if (messageType === "ProtocolMessage") {
        const content =
          typeof json.message.content === "object" && json.message.content
            ? (json.message.content as Record<string, any>)
            : {};
        // Tipos comuns observados: 0 (REVOKE_FOR_EVERYONE), "REVOKE",
        // "MESSAGE_REVOKE". Tratamos tudo que parecer revoke.
        const ptype = String(content.type ?? "").toUpperCase();
        const isRevoke =
          content.type === 0 ||
          ptype.includes("REVOKE") ||
          !!content.revokedMessageKey ||
          !!content.revokeMessageKey;

        if (isRevoke) {
          const revokedKey =
            content.key?.id ??
            content.revokedMessageKey?.id ??
            content.revokeMessageKey?.id ??
            content.id ??
            null;
          if (revokedKey) {
            try {
              const updated = await prisma.message.update({
                where: { messageId: String(revokedKey) },
                data: {
                  status: MessageStatus.DELETED,
                  body: null,
                  mediaUrl: null,
                  mediaType: null,
                  mediaCaption: null,
                  mimetype: null,
                  fileName: null,
                },
                select: { id: true, conversationId: true },
              });
              await pusherServer.trigger(
                updated.conversationId,
                "message:updated",
                {
                  messageId: updated.id,
                  conversationId: updated.conversationId,
                  status: MessageStatus.DELETED,
                },
              );
            } catch (err) {
              // Mensagem revogada pode não estar no nosso banco (foi
              // enviada antes da conversa ser importada) — não polui o log.
              console.debug(
                "[webhook:chat] revoke target not found",
                revokedKey,
              );
            }
          }
          return NextResponse.json({ success: true, revoked: true });
        }
        // ProtocolMessage de outro tipo (ex: confirmação de leitura) —
        // ignora silenciosamente.
        return NextResponse.json({ success: true, ignored: "protocol" });
      }

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
        messageType === "Conversation" ||
        messageType === "TemplateButtonReplyMessage" ||
        messageType === "ButtonsResponseMessage" ||
        messageType === "ListResponseMessage" ||
        messageType === "InteractiveResponseMessage"
      ) {
        const content =
          typeof json.message.content === "object" && json.message.content
            ? (json.message.content as Record<string, any>)
            : {};
        const interactiveBody =
          content.selectedDisplayText ||
          content.selectedButtonId ||
          content.title ||
          json.message.vote ||
          "";
        const finalBody = body || interactiveBody;

        messageData = await prisma.message.upsert({
          where: { messageId: editedMessageData?.messageId || messageId },
          update: {
            status: MessageStatus.SEEN,
            body: finalBody || editedMessageData?.body,
            createdAt,
          },
          create: {
            fromMe,
            conversationId: lead.conversation?.id!,
            senderId,
            messageId,
            body: finalBody,
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
              const imageResponse = await fetch(image.fileURL, {
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
              });
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
            try {
              const documentResponse = await fetch(document.fileURL, {
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
              });
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
            } catch (error) {
              console.error("[webhook:chat] document_upload_failed", error);
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
            const audioResponse = await fetch(audio.fileURL, {
              signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            });
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
      if (messageType === "LocationMessage" || messageType === "Location") {
        const content = (
          typeof json.message.content === "object" && json.message.content
            ? json.message.content
            : {}
        ) as Record<string, any>;
        const latitude = Number(
          content.degreesLatitude ?? content.latitude ?? content.lat,
        );
        const longitude = Number(
          content.degreesLongitude ?? content.longitude ?? content.lng,
        );
        const locName: string | null = content.name ?? null;
        const address: string | null = content.address ?? null;

        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          messageData = await prisma.message.upsert({
            where: { messageId },
            update: {
              status: MessageStatus.SEEN,
              latitude,
              longitude,
              createdAt,
            },
            create: {
              fromMe,
              conversationId: lead.conversation?.id!,
              senderId,
              messageId,
              status: MessageStatus.SEEN,
              quotedMessageId: quotedMessageData?.id,
              createdAt,
              senderName: name,
              latitude,
              longitude,
              mediaType: "location",
              body: [locName, address].filter(Boolean).join(" — ") || null,
            },
            include: {
              quotedMessage: true,
              conversation: { include: { lead: true } },
            },
          });
        }
      }
      if (messageType === "StickerMessage") {
        const document = await downloadFile({
          token: json.token,
          baseUrl: process.env.NEXT_PUBLIC_UAZAPI_BASE_URL,
          data: { id: messageId, return_base64: false },
        });
        let key = null;
        if (document?.fileURL) {
          try {
            const documentResponse = await fetch(document.fileURL, {
              signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            });
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
          } catch (error) {
            console.error("[webhook:chat] sticker_upload_failed", error);
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

      if (
        messageType === "ContactMessage" ||
        messageType === "ContactsArrayMessage"
      ) {
        const content = (
          typeof json.message.content === "object" && json.message.content
            ? json.message.content
            : {}
        ) as Record<string, any>;

        const extractFromVcard = (vcard: string | undefined | null) => {
          if (!vcard || typeof vcard !== "string") return null;
          const fnMatch = vcard.match(
            /(?:^|\r?\n)(?:item\d+\.)?FN[^:]*:([^\r\n]+)/i,
          );
          const telLine = vcard.match(
            /(?:^|\r?\n)(?:item\d+\.)?TEL[^:]*:([^\r\n]+)/i,
          );
          let phone: string | null = null;
          if (telLine) {
            const waidMatch = telLine[0].match(/waid=([0-9]+)/i);
            phone = waidMatch
              ? waidMatch[1]
              : telLine[1].replace(/[^0-9+]/g, "");
          }
          return {
            name: fnMatch?.[1]?.trim() || null,
            phone,
          };
        };

        const firstContact =
          (Array.isArray(content.contacts) && content.contacts[0]) || content;

        const parsed = extractFromVcard(firstContact.vcard);
        const contactName =
          firstContact.displayName ||
          firstContact.fullName ||
          parsed?.name ||
          null;
        const contactPhone = parsed?.phone || firstContact.phoneNumber || null;

        if (contactName || contactPhone) {
          messageData = await prisma.message.upsert({
            where: { messageId },
            update: {
              status: MessageStatus.SEEN,
              body: contactName,
              fileName: contactPhone,
              createdAt,
            },
            create: {
              fromMe,
              conversationId: lead.conversation?.id!,
              senderId,
              messageId,
              status: MessageStatus.SEEN,
              quotedMessageId: quotedMessageData?.id,
              createdAt,
              senderName: name,
              mediaType: "contact",
              body: contactName,
              fileName: contactPhone,
            },
            include: {
              quotedMessage: true,
              conversation: { include: { lead: true } },
            },
          });
        }
      }

      if (!messageData) {
        return NextResponse.json(
          { success: true, warning: "Message type not processed" },
          { status: 201 },
        );
      }
      // Atualiza timestamps de jornada do lead. firstResponseAt só é setado
      // quando atendente (fromMe=true) responde APÓS lead ter mandado inbound.
      const now = new Date();
      const shouldSetFirstResponse =
        fromMe && !lead.firstResponseAt && lead.lastInboundAt;

      await prisma.conversation.update({
        where: {
          leadId_trackingId: {
            leadId: lead.id,
            trackingId,
          },
        },
        data: {
          lastMessage: {
            connect: { id: messageData.id },
          },
          lead: {
            update: {
              updatedAt: now,
              ...(fromMe ? { lastOutboundAt: now } : { lastInboundAt: now }),
              ...(shouldSetFirstResponse ? { firstResponseAt: now } : {}),
            },
          },
        },
      });

      // Track timeline events (best-effort).
      if (fromMe) {
        await trackLeadEvent({
          leadId: lead.id,
          kind: "message_out",
          metadata: { channel: "WHATSAPP", messageId },
        });
        if (shouldSetFirstResponse) {
          await trackLeadEvent({
            leadId: lead.id,
            kind: "first_response",
            metadata: { channel: "WHATSAPP" },
          });
        }
      } else {
        await trackLeadEvent({
          leadId: lead.id,
          kind: "message_in",
          metadata: { channel: "WHATSAPP", messageId },
        });

        // Alert engine — publica chat.message_received pra alertas de inbound.
        // Best-effort: falha não pode quebrar o webhook.
        try {
          const tracking = await prisma.tracking.findUnique({
            where: { id: trackingId },
            select: { organizationId: true },
          });
          if (tracking && lead.conversation?.id) {
            await eventBus.publish("chat.message_received", {
              conversationId: lead.conversation.id,
              messageId: messageData.id,
              isInbound: true,
              orgId: tracking.organizationId,
            });
          }
        } catch (err) {
          console.error("[webhook:chat] alert publish falhou:", err);
        }
      }

      if (
        !fromMe &&
        lead.isActive &&
        tracking.globalAiActive &&
        lead.conversation?.id
      ) {
        try {
          await inngest.send({
            name: "chat/ai.whatsapp-message-received",
            data: {
              trackingId,
              leadId: lead.id,
              conversationId: lead.conversation.id,
              messageId: messageData.id,
              organizationId: tracking.organizationId,
            },
          });
        } catch (error) {
          console.error("[webhook:chat] inngest_send_failed", error);
        }
      }

      if (!fromMe) {
        // Idle automation (aba "Interações"): só emite se houver config ativa
        // pra esse tracking — evita invocar o scheduler em vão.
        try {
          const { dispatchIdleActivityIfActive } = await import(
            "@/features/tracking-settings/lib/idle-automation-gate"
          );
          await dispatchIdleActivityIfActive({
            leadId: lead.id,
            trackingId,
            organizationId: tracking.organizationId,
          });
        } catch (error) {
          console.error("[webhook:chat] idle_gate_failed", error);
        }
      }

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

    if (base.data.EventType === "connection") {
      const newStatus = String(json.instance?.status ?? "").toLowerCase();

      if (newStatus === "disconnected") {
        await prisma.whatsAppInstance.update({
          where: { apiKey: json.token },
          data: {
            status: WhatsAppInstanceStatus.DISCONNECTED,
          },
        });
        // Incrementa contador + ativa modo In-Chat se passar do threshold.
        // Detecção push-based — substitui a necessidade de cron a cada 5min
        // varrendo todas as instâncias da plataforma.
        const { markInstanceConnectionFailure } = await import(
          "@/features/tracking-chat/lib/in-chat-mode"
        );
        await markInstanceConnectionFailure({
          apiKey: json.token,
          source: "webhook",
        });
      } else if (newStatus === "connected") {
        // Reconexão bem-sucedida — zera contador + desativa modo se
        // estava ligado. Espelho do `markInstanceConnectionFailure` mas
        // pro sucesso. Roda mesmo sem cron de recovery rodar antes.
        const { markInstanceConnectionHealthy } = await import(
          "@/features/tracking-chat/lib/in-chat-mode"
        );
        await markInstanceConnectionHealthy({ apiKey: json.token });
      }
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // ── Chamadas (voz/vídeo) recebidas no WhatsApp ───────────────────────
    // O uazapi entrega via EventType: "calls" com payload do tipo
    // { call: { chatid, from, isVideo, status, duration, ... } }.
    // Persistimos como Message com mediaType="voice_call"/"video_call" +
    // body JSON com status/duração. UI já renderiza via `CallMessageBox`.
    if (base.data.EventType === "calls") {
      const callsParsed = callsEventSchema.safeParse(json);
      if (!callsParsed.success) {
        console.warn("[webhook:chat:calls] invalid_payload", {
          trackingId,
          issues: callsParsed.error.issues,
        });
        return NextResponse.json(
          { ok: false, reason: "invalid_calls_payload" },
          { status: 200 },
        );
      }

      const call = callsParsed.data.call ?? ({} as any);
      // Loga o payload inteiro pra ajudar a corrigir o schema se o
      // formato da uazapi variar.
      console.info("[webhook:chat:calls] received", { trackingId, call });

      const callId =
        call.id || call.callid || `uazapi-call-${call.timestamp ?? Date.now()}`;
      const callChatid = call.chatid || call.from;
      if (!callChatid) {
        return NextResponse.json(
          { ok: false, reason: "missing_chatid" },
          { status: 200 },
        );
      }

      const callPhone = String(callChatid).split("@")[0];

      // Acha o Lead/Conversation. Se não existe, ignora (não cria lead
      // só de chamada — espera primeira mensagem texto pra fazer o
      // round-robin, igual o webhook de messages faz).
      const callLead = await prisma.lead.findUnique({
        where: { phone_trackingId: { phone: callPhone, trackingId } },
        select: { id: true, conversation: { select: { id: true } } },
      });

      if (!callLead?.conversation) {
        return NextResponse.json(
          { ok: true, skipped: "lead_or_conversation_not_found" },
          { status: 200 },
        );
      }

      const isVideo = !!call.isVideo;
      const fromMe = !!call.fromMe;
      const rawStatus = String(call.status ?? "").toLowerCase();

      // Mapeia status do uazapi pro nosso enum de UI.
      // - offer/ringing → "started" (em curso ou recém-iniciada)
      // - accept/answered → "completed" (atendida; vai virar definitivamente
      //   completed quando o `terminate` chegar)
      // - reject/decline → "declined"
      // - terminate/hangup com duration 0 → "missed"
      // - terminate/hangup com duration > 0 → "completed"
      // - timeout/missed → "missed"
      let mappedStatus: "started" | "completed" | "missed" | "declined";
      if (rawStatus === "accept" || rawStatus === "answered") {
        mappedStatus = "completed";
      } else if (rawStatus === "reject" || rawStatus === "decline" || rawStatus === "declined") {
        mappedStatus = "declined";
      } else if (
        rawStatus === "missed" ||
        rawStatus === "timeout" ||
        (rawStatus.includes("terminate") && (!call.duration || call.duration === 0))
      ) {
        mappedStatus = "missed";
      } else if (rawStatus.includes("terminate") || rawStatus === "hangup") {
        mappedStatus = call.duration && call.duration > 0 ? "completed" : "missed";
      } else {
        // offer / ringing / desconhecido — assume "started"
        mappedStatus = "started";
      }

      const callMessageId = `wa-call-${callId}`;
      const callMediaType = isVideo ? "video_call" : "voice_call";
      const callBody = JSON.stringify({
        type: isVideo ? "video" : "voice",
        status: mappedStatus,
        durationSec: call.duration ?? null,
        callId,
        rawStatus,
      });

      const callMessage = await prisma.message.upsert({
        where: { messageId: callMessageId },
        update: {
          body: callBody,
          status: MessageStatus.SEEN,
        },
        create: {
          messageId: callMessageId,
          conversationId: callLead.conversation.id,
          body: callBody,
          mediaType: callMediaType,
          fromMe,
          senderName: fromMe ? "Atendente" : null,
          senderId: fromMe ? null : callChatid,
          status: MessageStatus.SEEN,
          createdAt: call.timestamp ? new Date(call.timestamp) : new Date(),
        },
        select: {
          id: true,
          messageId: true,
          body: true,
          mediaType: true,
          createdAt: true,
          fromMe: true,
          status: true,
          conversationId: true,
          senderId: true,
          senderName: true,
        },
      });

      // Pusher pra atualizar UI em tempo real (mesmo evento que outras
      // mensagens — o front já escuta).
      await pusherServer.trigger(
        callMessage.conversationId,
        "message:new",
        {
          ...callMessage,
          conversation: {
            id: callMessage.conversationId,
            lead: { id: callLead.id, name: "" },
          },
        },
      );

      return NextResponse.json({ success: true, status: mappedStatus }, { status: 201 });
    }
    if (base.data.EventType === "labels") {
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
    if (base.data.EventType === "chat_labels") {
      const chatLabelsParsed = chatLabelsEventSchema.safeParse(json);
      if (!chatLabelsParsed.success) {
        console.warn("[webhook:chat] invalid_chat_labels", {
          trackingId,
          issues: chatLabelsParsed.error.issues,
        });
        return NextResponse.json(
          { ok: false, reason: "invalid_chat_labels_payload" },
          { status: 200 },
        );
      }

      const remoteJid = json.message.chatid;
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
    console.error("[webhook:chat] unhandled", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
