// Limite diário de contatos únicos da Meta no disparo (spec 0040, RF-7): a
// campanha maior que o limite sai em lotes, um "dia" de 24h por vez.

import "server-only";
import prisma from "@/lib/prisma";
import { getPhoneNumbers } from "@/http/whats-oficial";
import { resolveMessagingLimit, type MessagingLimitLevel } from "@/features/campanhas/lib/messaging-limits";
import type { ResolvedCampaignMetaCredentials } from "./broadcast-access";

const DAY_MS = 24 * 60 * 60_000;

/** Nível atual do número na Meta. Falhou a leitura, assume o nível de conta nova (seguro). */
export async function resolveNumberMessagingLimit(credentials: ResolvedCampaignMetaCredentials): Promise<MessagingLimitLevel> {
  try {
    const response = await getPhoneNumbers({ wabaId: credentials.wabaId, accessToken: credentials.accessToken });
    const phone = response.data?.find((number) => number.id === credentials.phoneNumberId) ?? response.data?.[0];
    return resolveMessagingLimit(phone?.messaging_limit_tier);
  } catch {
    return resolveMessagingLimit(null);
  }
}

/**
 * Quantos contatos únicos ainda cabem nas últimas 24h para o número do
 * tracking (todas as campanhas dele). `null` = sem limite.
 */
export async function remainingDailyContacts(trackingId: string, level: MessagingLimitLevel, now = new Date()): Promise<number | null> {
  if (level.dailyUniqueContacts === null) return null;
  const contactedToday = await prisma.broadcastRecipient.groupBy({
    by: ["phone"],
    where: { broadcast: { trackingId }, sentAt: { gte: new Date(now.getTime() - DAY_MS) } },
  });
  return Math.max(0, level.dailyUniqueContacts - contactedToday.length);
}

/** Quando o contato mais antigo da janela sai das 24h — a hora em que abre saldo de novo. */
export async function nextQuotaReleaseAt(trackingId: string, now = new Date()): Promise<Date> {
  const oldest = await prisma.broadcastRecipient.findFirst({
    where: { broadcast: { trackingId }, sentAt: { gte: new Date(now.getTime() - DAY_MS) } },
    orderBy: { sentAt: "asc" },
    select: { sentAt: true },
  });
  const releaseAt = oldest?.sentAt ? oldest.sentAt.getTime() + DAY_MS : now.getTime() + DAY_MS;
  return new Date(Math.max(releaseAt, now.getTime()) + 60_000);
}
