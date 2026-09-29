import "server-only";
import prisma from "@/lib/prisma";
import {
  IP_MESSAGES_PER_MINUTE,
  IP_NEW_VISITORS_PER_HOUR,
  VISITOR_MESSAGES_PER_MINUTE,
  VISITOR_MIN_INTERVAL_MS,
} from "../lib/constants";

/** Limites de volume do ASTRO CHAT contados no banco (spec 0031, TR-4 e D-6). */

export async function isNewVisitorAllowed(ipHash: string): Promise<boolean> {
  const createdLastHour = await prisma.astroChatVisitor.count({
    where: { ipHash, createdAt: { gte: new Date(Date.now() - 60 * 60_000) } },
  });
  return createdLastHour < IP_NEW_VISITORS_PER_HOUR;
}

/**
 * Intervalo mínimo por visitante num UPDATE condicional: duas requisições
 * simultâneas não passam juntas, ao contrário de contar e depois gravar.
 */
async function claimVisitorMessageSlot(visitorId: string): Promise<boolean> {
  const claimed = await prisma.$executeRaw`
    UPDATE "astro_chat_visitors"
    SET "last_message_at" = NOW()
    WHERE "id" = ${visitorId}
      AND ("last_message_at" IS NULL OR "last_message_at" < NOW() - (${VISITOR_MIN_INTERVAL_MS} * INTERVAL '1 millisecond'))
  `;
  return claimed > 0;
}

export async function isVisitorMessageAllowed(params: {
  visitorId: string;
  conversationId: string | null;
  ipHash: string;
}): Promise<boolean> {
  if (!(await claimVisitorMessageSlot(params.visitorId))) return false;

  const lastMinute = new Date(Date.now() - 60_000);
  if (params.conversationId) {
    const visitorCount = await prisma.message.count({
      where: { conversationId: params.conversationId, fromMe: false, createdAt: { gte: lastMinute } },
    });
    if (visitorCount >= VISITOR_MESSAGES_PER_MINUTE) return false;
  }

  const ipCount = await prisma.message.count({
    where: {
      fromMe: false,
      createdAt: { gte: lastMinute },
      conversation: { lead: { astroChatVisitors: { some: { ipHash: params.ipHash } } } },
    },
  });
  return ipCount < IP_MESSAGES_PER_MINUTE;
}

/**
 * Reserva uma resposta de IA no teto diário do site. Atômico: o contador zera
 * na virada do dia (UTC) e só incrementa enquanto estiver abaixo do teto.
 */
export async function reserveDailyAiReply(siteId: string): Promise<boolean> {
  const today = new Date(new Date().toISOString().slice(0, 10));
  const reserved = await prisma.$executeRaw`
    UPDATE "astro_chat_sites"
    SET "ai_replies_count" = CASE WHEN "ai_replies_day" = ${today}::date THEN "ai_replies_count" + 1 ELSE 1 END,
        "ai_replies_day" = ${today}::date
    WHERE "id" = ${siteId}
      AND ("ai_replies_day" IS DISTINCT FROM ${today}::date OR "ai_replies_count" < "daily_ai_reply_limit")
  `;
  return reserved > 0;
}
