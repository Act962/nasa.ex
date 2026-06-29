import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { findMessages } from "@/http/uazapi/find-messages";
import { requireUazapiToken } from "@/features/tracking-chat/lib/providers/uazapi-credentials";
import { MessageStatus } from "@/generated/prisma/enums";
import type { FindMessageItem } from "@/http/uazapi/types";

/**
 * Sincroniza mensagens recentes de uma conversa **agora** (síncrono).
 *
 * **Por que existe**: em ambiente local (`localhost:3000`), o webhook do
 * uazapi (`/api/chat/webhook`) é inalcançável — uazapi roda em servidor
 * externo e não consegue postar em localhost. Resultado: mensagens
 * recebidas não chegam ao banco automaticamente.
 *
 * Esse endpoint puxa as últimas N mensagens via `uazapi /message/find`
 * e cria as novas no banco. Idempotente — duplicatas são skipadas via
 * `messageId` (unique no schema). Não dispara workflows nem Inngest
 * (não é nosso "real" webhook), apenas popula o banco pra UI ver.
 *
 * **Em produção, ainda funciona** mas é redundante (webhook já cuida).
 * O frontend só ativa polling em dev (`NODE_ENV === "development"`).
 *
 * Cobra 0★ — operação interna de organização.
 *
 * **Limite**: pega só 1 página de 30 mensagens. Pra sincronização
 * completa (histórico inteiro), usar o Inngest job `chat/messages.sync`
 * via `conversation.importExistingChats`.
 */

const mediaTypeFromMessageType = (t: string): string | null => {
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
    case "VoiceCall":
    case "VoiceCallMessage":
    case "CallLogMessage":
    case "CallLog":
      return "voice_call";
    case "VideoCall":
    case "VideoCallMessage":
      return "video_call";
    default:
      return null;
  }
};

function mapUazapiToPrisma(message: FindMessageItem, conversationId: string) {
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

  // Pra mensagens de chamada, monta body JSON consumido por
  // `CallMessageBox` (UI). Status `"missed"` por default — chamadas que
  // aparecem como mensagem no histórico são tipicamente perdidas.
  // Se o uazapi entregar duration > 0, marca como completed.
  if (mediaType === "voice_call" || mediaType === "video_call") {
    const duration = Number(content.duration ?? content.callDuration ?? 0);
    const rawStatus = String(content.callStatus ?? content.status ?? "")
      .toLowerCase();
    let status: "completed" | "missed" | "declined" = "missed";
    if (rawStatus === "accepted" || rawStatus === "answered" || duration > 0) {
      status = "completed";
    } else if (rawStatus === "rejected" || rawStatus === "declined") {
      status = "declined";
    }
    body = JSON.stringify({
      type: mediaType === "video_call" ? "video" : "voice",
      status,
      durationSec: duration > 0 ? duration : null,
      callId: message.messageid,
    });
  }

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

export const syncNowConversation = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/conversation/sync-now",
    summary: "Sync immediate (pull recent messages via uazapi)",
    tags: ["Conversation", "Tracking Chat"],
  })
  .input(
    z.object({
      conversationId: z.string().min(1),
      /** Quantas mensagens recentes puxar. Default 30 (1 página). */
      limit: z.number().int().min(1).max(100).default(30),
    }),
  )
  .output(
    z.object({
      imported: z.number().int(),
      skipped: z.number().int(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const conv = await prisma.conversation.findUnique({
      where: { id: input.conversationId },
      select: {
        id: true,
        remoteJid: true,
        trackingId: true,
        tracking: {
          select: {
            organizationId: true,
            whatsappInstance: {
              select: { apiKey: true, baseUrl: true, status: true },
            },
          },
        },
      },
    });

    if (!conv || conv.tracking.organizationId !== context.org.id) {
      throw errors.NOT_FOUND({ message: "Conversa não encontrada" });
    }
    if (!conv.remoteJid) {
      throw errors.BAD_REQUEST({ message: "Conversa sem remoteJid" });
    }
    if (!conv.tracking.whatsappInstance) {
      throw errors.BAD_REQUEST({
        message: "Tracking sem instância WhatsApp",
      });
    }

    // A uazapi `/message/find` retorna mensagens em ordem cronológica
    // CRESCENTE (mais antigas no offset 0). Pra capturar mensagens novas
    // do lead a gente precisa percorrer até o fim da lista — `hasMore`
    // false. Mas com cap de páginas pra não travar em chats com
    // 1000+ mensagens.
    const MAX_PAGES = 20; // até 20*100 = 2000 mensagens por tick
    const PAGE_LIMIT = Math.min(input.limit, 100);
    let totalImported = 0;
    let totalSkipped = 0;
    let offset = 0;
    let pages = 0;

    while (pages < MAX_PAGES) {
      let response;
      try {
        response = await findMessages(
          requireUazapiToken(conv.tracking.whatsappInstance.apiKey),
          { chatid: conv.remoteJid, limit: PAGE_LIMIT, offset },
          conv.tracking.whatsappInstance.baseUrl ?? undefined,
        );
      } catch (err: any) {
        // Em dev, log verboso pra entender o que a uazapi tá rejeitando.
        console.warn("[conversation.syncNow] uazapi find-messages failed", {
          message: err?.message,
          chatid: conv.remoteJid,
          offset,
        });
        break;
      }

      const incoming = response.messages ?? [];
      if (incoming.length === 0) {
        if (pages === 0) {
          console.debug("[conversation.syncNow] uazapi returned 0 messages", {
            chatid: conv.remoteJid,
            conversationId: conv.id,
          });
        }
        break;
      }

      // Dedup por messageId — quem já está no banco pula
      const ids = incoming.map((m) => m.messageid);
      const existing = await prisma.message.findMany({
        where: { messageId: { in: ids } },
        select: { messageId: true },
      });
      const existingSet = new Set(existing.map((m) => m.messageId));
      const toInsert = incoming
        .filter((m) => !existingSet.has(m.messageid))
        .map((m) => mapUazapiToPrisma(m, conv.id));

      if (toInsert.length > 0) {
        const result = await prisma.message.createMany({
          data: toInsert,
          skipDuplicates: true,
        });
        totalImported += result.count;
      }
      totalSkipped += incoming.length - toInsert.length;

      pages += 1;
      if (!response.hasMore) break;
      offset = response.nextOffset ?? offset + PAGE_LIMIT;
    }

    // Atualiza `Conversation.lastMessage` com a mensagem mais recente do
    // banco — assim a sidebar mostra preview correto. Roda SEMPRE (mesmo
    // se importou 0), porque muitas conversas antigas ficaram com
    // `lastMessageId = null` (procedures de envio antigas não setavam
    // esse campo). Esse loop faz o backfill incremental.
    const latest = await prisma.message.findFirst({
      where: { conversationId: conv.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true },
    });
    if (latest) {
      await prisma.conversation.update({
        where: { id: conv.id },
        data: {
          lastMessage: { connect: { id: latest.id } },
          lastMessageAt: latest.createdAt,
        },
      });
    }

    return { imported: totalImported, skipped: totalSkipped };
  });
