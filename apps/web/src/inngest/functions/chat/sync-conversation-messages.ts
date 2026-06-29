import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { findMessages } from "@/http/uazapi/find-messages";
import { requireUazapiToken } from "@/features/tracking-chat/lib/providers/uazapi-credentials";
import { pusherServer } from "@/lib/pusher";
import { MessageStatus } from "@/generated/prisma/enums";
import type { FindMessageItem } from "@/http/uazapi/types";

const PAGE_SIZE = 100;
const MAX_PAGES = 200;

function mediaTypeFromMessageType(t: string): string | null {
  switch (t) {
    case "ImageMessage":
      return "image";
    case "AudioMessage":
      return "audio";
    case "VideoMessage":
      return "video";
    case "DocumentMessage":
      return "document";
    case "StickerMessage":
      return "sticker";
    case "LocationMessage":
    case "Location":
      return "location";
    default:
      return null;
  }
}

function mapUazapiToPrisma(message: FindMessageItem, conversationId: string) {
  // messageTimestamp já vem em MILISSEGUNDOS no /message/find (13 dígitos).
  const baseTs = message.messageTimestamp
    ? new Date(message.messageTimestamp)
    : new Date();
  const content =
    typeof message.content === "object" && message.content
      ? (message.content as Record<string, any>)
      : ({} as Record<string, any>);

  let body: string | null =
    message.text || content.text || content.caption || content.title || null;

  let latitude: number | null = null;
  let longitude: number | null = null;
  if (
    message.messageType === "LocationMessage" ||
    message.messageType === "Location"
  ) {
    const lat = Number(content.degreesLatitude ?? content.latitude);
    const lng = Number(content.degreesLongitude ?? content.longitude);
    if (Number.isFinite(lat)) latitude = lat;
    if (Number.isFinite(lng)) longitude = lng;
    body = [content.name, content.address].filter(Boolean).join(" — ") || null;
  }

  const mediaType = mediaTypeFromMessageType(message.messageType);

  return {
    messageId: message.messageid,
    body,
    fromMe: !!message.fromMe,
    status: MessageStatus.SEEN,
    conversationId,
    senderId: message.sender ?? null,
    senderName: message.senderName ?? null,
    createdAt: baseTs,
    mediaType,
    mediaUrl: null,
    fileName: content.fileName ?? content.title ?? null,
    mimetype: content.mimetype ?? null,
    latitude,
    longitude,
  };
}

export const chatSyncMessages = inngest.createFunction(
  {
    id: "chat-sync-messages",
    concurrency: { limit: 5, key: "event.data.trackingId" },
    retries: 2,
  },
  { event: "chat/messages.sync" },
  async ({ event, step, logger }) => {
    const { conversationId } = event.data as { conversationId: string };

    const context = await step.run("load-context", async () => {
      const conv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          remoteJid: true,
          trackingId: true,
          tracking: {
            select: {
              whatsappInstance: {
                select: { apiKey: true, baseUrl: true },
              },
            },
          },
        },
      });
      if (!conv?.remoteJid) {
        throw new Error("Conversation/remoteJid not found");
      }
      if (!conv.tracking?.whatsappInstance) {
        throw new Error("WhatsApp instance not connected for this tracking");
      }
      return {
        remoteJid: conv.remoteJid,
        apiKey: conv.tracking.whatsappInstance.apiKey,
        baseUrl: conv.tracking.whatsappInstance.baseUrl,
      };
    });

    let offset = 0;
    let totalImported = 0;
    let pages = 0;

    while (pages < MAX_PAGES) {
      const result: { imported: number; hasMore: boolean; nextOffset: number } =
        await step.run(`page-${pages}`, async () => {
          const response = await findMessages(
            requireUazapiToken(context.apiKey),
            { chatid: context.remoteJid, limit: PAGE_SIZE, offset },
            context.baseUrl ?? undefined,
          );
          const incoming = response.messages ?? [];
          if (incoming.length === 0) {
            return { imported: 0, hasMore: false, nextOffset: 0 };
          }

          const ids = incoming.map((message) => message.messageid);
          const existing = await prisma.message.findMany({
            where: { messageId: { in: ids } },
            select: { messageId: true },
          });
          const existingSet = new Set(existing.map((m) => m.messageId));
          const toInsert = incoming
            .filter((message) => !existingSet.has(message.messageid))
            .map((message) => mapUazapiToPrisma(message, conversationId));

          if (toInsert.length > 0) {
            await prisma.message.createMany({
              data: toInsert,
              skipDuplicates: true,
            });
          }
          return {
            imported: toInsert.length,
            hasMore: !!response.hasMore,
            nextOffset: response.nextOffset ?? 0,
          };
        });

      totalImported += result.imported;
      pages += 1;
      if (!result.hasMore) break;
      offset = result.nextOffset;
    }

    await step.run("notify", async () => {
      await pusherServer.trigger(conversationId, "messages:synced", {
        imported: totalImported,
        conversationId,
      });
    });

    logger.info("[chat-sync-messages] done", {
      conversationId,
      totalImported,
      pages,
    });
    return { totalImported, pages };
  },
);
