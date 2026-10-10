// Custos do número por conta do cliente, com histórico (spec 0087, Parte F).
// Tudo vem do registro de custos por evento (`UsageEvent`) e do extrato de Stars: sem tabela nova.

import "server-only";
import prisma from "@/lib/prisma";
import { getPricingAnalytics } from "@/http/whats-oficial";
import { hasStarsCredit } from "@/features/stars/lib/stars-credit";
import { resolveCampaignMetaCredentials } from "./broadcast-access";

export const CALL_MINUTE_ACTION = "astro_whatsapp_call_minute";
export const CHAT_MESSAGE_ACTION = "message_send";
/** Gasto do dia cobrado pela Meta no cartão do cliente: não é custo da Órbita, fica só como histórico. */
export const META_DAILY_SPEND_ACTION = "meta_daily_spend";
const NUMBER_FEE_APP_SLUG = "salvy-number";
const BRAZIL_OFFSET_MS = 3 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
const MAX_EVENTS = 5000;
const MAX_ENTRIES = 200;

export const NUMBER_COST_KINDS = ["call", "meta", "chat", "number"] as const;
export type NumberCostKind = (typeof NUMBER_COST_KINDS)[number];

export interface NumberCostEntry {
  id: string;
  occurredAt: string;
  kind: NumberCostKind;
  title: string;
  detail: string;
  chargedBy: "META" | "ORBITA";
  stars: number | null;
  amountBrl: number | null;
}

/** "2026-10" → início e fim do mês no horário de Brasília. */
function monthBounds(month: string): { since: Date; until: Date } {
  const [year, monthNumber] = month.split("-").map(Number);
  return {
    since: new Date(Date.UTC(year, monthNumber - 1, 1) + BRAZIL_OFFSET_MS),
    until: new Date(Date.UTC(year, monthNumber, 1) + BRAZIL_OFFSET_MS),
  };
}

export function currentBrazilMonth(now = new Date()): string {
  return new Date(now.getTime() - BRAZIL_OFFSET_MS).toISOString().slice(0, 7);
}

function brazilDay(date: Date): string {
  return new Date(date.getTime() - BRAZIL_OFFSET_MS).toISOString().slice(0, 10);
}

function readMetaSpend(metadata: unknown): { date: string; category: string; amount: number; currency: string | null } | null {
  if (!metadata || typeof metadata !== "object") return null;
  const record = metadata as Record<string, unknown>;
  if (typeof record.date !== "string" || typeof record.amount !== "number") return null;
  return {
    date: record.date,
    category: typeof record.category === "string" ? record.category : "OUTROS",
    amount: record.amount,
    currency: typeof record.currency === "string" ? record.currency : null,
  };
}

async function loadNumberEvents(params: { organizationId: string; trackingId: string; month: string }) {
  const { since, until } = monthBounds(params.month);
  const [events, numberFees] = await Promise.all([
    prisma.usageEvent.findMany({
      where: {
        organizationId: params.organizationId,
        trackingId: params.trackingId,
        action: { in: [CALL_MINUTE_ACTION, CHAT_MESSAGE_ACTION, META_DAILY_SPEND_ACTION] },
        createdAt: { gte: since, lt: until },
      },
      select: { id: true, action: true, sessionId: true, userId: true, starsCharged: true, quantity: true, metadata: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: MAX_EVENTS,
    }),
    // A mensalidade do número é debitada em Stars para a empresa; só entra se este número for o comprado.
    prisma.salvyVirtualNumber
      .findFirst({ where: { organizationId: params.organizationId, trackingId: params.trackingId }, select: { phoneNumber: true } })
      .then((number) =>
        number
          ? prisma.starTransaction
              .findMany({
                where: { organizationId: params.organizationId, appSlug: NUMBER_FEE_APP_SLUG, createdAt: { gte: since, lt: until } },
                select: { id: true, amount: true, createdAt: true },
                orderBy: { createdAt: "desc" },
              })
              .then((transactions) => ({ phoneNumber: number.phoneNumber, transactions }))
          : null,
      ),
  ]);
  return { events, numberFees };
}

/** Resumo do mês por número: chamadas, mensagens, mensalidade e o gasto guardado da Meta. */
export async function loadNumberCostSummary(params: { organizationId: string; trackingId: string; month: string }) {
  const [{ events, numberFees }, organization, hasCredit] = await Promise.all([
    loadNumberEvents(params),
    prisma.organization.findUnique({ where: { id: params.organizationId }, select: { starsBalance: true, starsBonusBalance: true } }),
    hasStarsCredit(params.organizationId),
  ]);

  const callEvents = events.filter((event) => event.action === CALL_MINUTE_ACTION);
  const chatEvents = events.filter((event) => event.action === CHAT_MESSAGE_ACTION);
  const metaByCategory = new Map<string, number>();
  let metaCurrency: string | null = null;
  for (const event of events) {
    if (event.action !== META_DAILY_SPEND_ACTION) continue;
    const spend = readMetaSpend(event.metadata);
    if (!spend) continue;
    metaCurrency = spend.currency ?? metaCurrency;
    metaByCategory.set(spend.category, (metaByCategory.get(spend.category) ?? 0) + spend.amount);
  }
  const sumStars = (list: typeof events) => list.reduce((total, event) => total + event.starsCharged, 0);

  return {
    month: params.month,
    credit: {
      stars: (organization?.starsBalance ?? 0) + (organization?.starsBonusBalance ?? 0),
      hasCredit,
    },
    calls: {
      count: new Set(callEvents.map((event) => event.sessionId ?? event.id)).size,
      minutes: callEvents.reduce((total, event) => total + Number(event.quantity ?? 1), 0),
      stars: sumStars(callEvents),
    },
    chatMessages: { count: chatEvents.length, stars: sumStars(chatEvents) },
    numberFee: {
      stars: numberFees ? numberFees.transactions.reduce((total, transaction) => total + Math.abs(transaction.amount), 0) : 0,
    },
    /** Gasto da Meta guardado dia a dia; o mês corrente também aparece ao vivo no painel do número. */
    storedMetaSpend: {
      currency: metaCurrency,
      total: [...metaByCategory.values()].reduce((total, amount) => total + amount, 0),
      byCategory: [...metaByCategory.entries()].map(([category, amount]) => ({ category, amount })),
    },
  };
}

/** Lançamentos do mês: uma linha por chamada, uma por dia de mensagens, uma por dia e categoria da Meta. */
export async function listNumberCostEntries(params: {
  organizationId: string;
  trackingId: string;
  month: string;
  kind?: NumberCostKind;
}): Promise<NumberCostEntry[]> {
  const { events, numberFees } = await loadNumberEvents(params);
  const entries: NumberCostEntry[] = [];

  const callsBySession = new Map<string, { firstAt: Date; minutes: number; stars: number; userId: string | null }>();
  const chatByDay = new Map<string, { lastAt: Date; count: number; stars: number }>();
  for (const event of events) {
    if (event.action === CALL_MINUTE_ACTION) {
      const sessionKey = event.sessionId ?? event.id;
      const call = callsBySession.get(sessionKey) ?? { firstAt: event.createdAt, minutes: 0, stars: 0, userId: event.userId };
      call.minutes += Number(event.quantity ?? 1);
      call.stars += event.starsCharged;
      if (event.createdAt < call.firstAt) call.firstAt = event.createdAt;
      callsBySession.set(sessionKey, call);
    } else if (event.action === CHAT_MESSAGE_ACTION) {
      const day = brazilDay(event.createdAt);
      const dayTotal = chatByDay.get(day) ?? { lastAt: event.createdAt, count: 0, stars: 0 };
      dayTotal.count += 1;
      dayTotal.stars += event.starsCharged;
      chatByDay.set(day, dayTotal);
    } else {
      const spend = readMetaSpend(event.metadata);
      if (!spend) continue;
      entries.push({
        id: event.id,
        occurredAt: event.createdAt.toISOString(),
        kind: "meta",
        title: "Gasto do dia na Meta",
        detail: spend.category,
        chargedBy: "META",
        stars: null,
        amountBrl: spend.currency === "BRL" || !spend.currency ? spend.amount : null,
      });
    }
  }

  const callerIds = [...new Set([...callsBySession.values()].map((call) => call.userId).filter((id): id is string => Boolean(id)))];
  const callers = callerIds.length
    ? await prisma.user.findMany({ where: { id: { in: callerIds } }, select: { id: true, name: true } })
    : [];
  const callerName = new Map(callers.map((user) => [user.id, user.name]));
  for (const [sessionKey, call] of callsBySession) {
    entries.push({
      id: `call:${sessionKey}`,
      occurredAt: call.firstAt.toISOString(),
      kind: "call",
      title: "Chamada de voz",
      detail: `${(call.userId && callerName.get(call.userId)) || "Chamada"} · ${call.minutes} min`,
      chargedBy: "ORBITA",
      stars: call.stars,
      amountBrl: null,
    });
  }
  for (const [day, dayTotal] of chatByDay) {
    entries.push({
      id: `chat:${day}`,
      occurredAt: dayTotal.lastAt.toISOString(),
      kind: "chat",
      title: "Mensagens pelo chat",
      detail: `${dayTotal.count} ${dayTotal.count === 1 ? "mensagem" : "mensagens"}`,
      chargedBy: "ORBITA",
      stars: dayTotal.stars,
      amountBrl: null,
    });
  }
  for (const transaction of numberFees?.transactions ?? []) {
    entries.push({
      id: `number:${transaction.id}`,
      occurredAt: transaction.createdAt.toISOString(),
      kind: "number",
      title: "Mensalidade do número",
      detail: numberFees?.phoneNumber ?? "",
      chargedBy: "ORBITA",
      stars: Math.abs(transaction.amount),
      amountBrl: null,
    });
  }

  return entries
    .filter((entry) => !params.kind || entry.kind === params.kind)
    .sort((first, second) => second.occurredAt.localeCompare(first.occurredAt))
    .slice(0, MAX_ENTRIES);
}

/**
 * Guarda o gasto de um dia na Meta, por categoria (RF-26). Hoje ele só é lido ao vivo e some se a
 * chave do número cair. `usingCustomKey` marca que o custo não é da Órbita: quem paga é o cliente, no
 * cartão dele na Meta. Roda uma vez por dia e não duplica o mesmo dia.
 */
export async function snapshotMetaDailySpend(params: { organizationId: string; trackingId: string; day: string }): Promise<{ saved: number }> {
  const alreadySaved = await prisma.usageEvent.findFirst({
    where: {
      organizationId: params.organizationId,
      trackingId: params.trackingId,
      action: META_DAILY_SPEND_ACTION,
      metadata: { path: ["date"], equals: params.day },
    },
    select: { id: true },
  });
  if (alreadySaved) return { saved: 0 };

  const credentials = await resolveCampaignMetaCredentials(params.trackingId, params.organizationId);
  const dayStart = new Date(`${params.day}T00:00:00.000Z`).getTime() + BRAZIL_OFFSET_MS;
  const pricing = await getPricingAnalytics({
    wabaId: credentials.wabaId,
    accessToken: credentials.accessToken,
    startUnix: Math.floor(dayStart / 1000),
    endUnix: Math.floor((dayStart + DAY_MS) / 1000),
  });
  const totals = new Map<string, { amount: number; volume: number }>();
  for (const point of pricing.pricing_analytics?.data?.flatMap((entry) => entry.data_points ?? []) ?? []) {
    const category = point.pricing_category ?? "OUTROS";
    const total = totals.get(category) ?? { amount: 0, volume: 0 };
    total.amount += point.cost ?? 0;
    total.volume += point.volume ?? 0;
    totals.set(category, total);
  }
  const rows = [...totals.entries()].filter(([, total]) => total.amount > 0 || total.volume > 0);
  if (rows.length === 0) return { saved: 0 };

  await prisma.usageEvent.createMany({
    data: rows.map(([category, total]) => ({
      organizationId: params.organizationId,
      trackingId: params.trackingId,
      kind: "MESSAGE" as const,
      action: META_DAILY_SPEND_ACTION,
      appSlug: "campanhas",
      feature: "campanhas.meta-daily-spend",
      provider: "meta",
      usingCustomKey: true,
      quantity: total.volume,
      quantityUnit: "message",
      priceSource: "byo_key",
      metadata: { date: params.day, category, amount: total.amount, currency: pricing.currency ?? null },
      // Meio-dia do próprio dia: o lançamento cai no mês certo qualquer que seja o fuso.
      createdAt: new Date(dayStart + DAY_MS / 2),
    })),
  });
  return { saved: rows.length };
}
