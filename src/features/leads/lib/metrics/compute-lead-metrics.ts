import "server-only";
import prisma from "@/lib/prisma";
import {
  computeConfidence,
  computePurchasePotential,
  toInterestLevel,
  type InterestLevel,
} from "./purchase-potential";

// Métricas do lead calculadas em código (spec 0035). Só leitura: quem grava é
// `save-lead-metrics.ts`, fora de qualquer transação (Regra 18).

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;
const WINDOW_DAYS = 90;
const MONTH_DAYS = 30;
/** Silêncio maior que isto abre uma nova rajada do lead. */
const NEW_BURST_GAP_MS = 4 * HOUR_MS;
/** Rajada sem resposta neste prazo conta como interação perdida. */
const LOSS_THRESHOLD_MS = 24 * HOUR_MS;
const DEFAULT_SLA_HOURS = 1;
const MAX_MESSAGES_READ = 3000;

export interface ComputedLeadMetrics {
  purchasePotential: number;
  interestLevel: InterestLevel;
  purchasesCount: number;
  interactionsPerMonth: number;
  avgAttendanceSeconds: number | null;
  interactionLossRate: number;
  avgResponseSeconds: number | null;
  qualityScore: number | null;
  resolutionRate: number | null;
  confidence: number;
  totalMessages: number;
}

interface TimedMessage {
  fromMe: boolean;
  createdAt: Date;
}

interface Burst {
  startedAt: Date;
  respondedAt: Date | null;
  lastReplyAt: Date | null;
}

/** Rajadas do lead e a resposta da equipe a cada uma. */
function toBursts(messages: TimedMessage[]): Burst[] {
  const bursts: Burst[] = [];
  let current: Burst | null = null;
  let previous: TimedMessage | null = null;
  for (const message of messages) {
    if (!message.fromMe) {
      const opensBurst =
        !current ||
        previous?.fromMe === true ||
        (previous && message.createdAt.getTime() - previous.createdAt.getTime() > NEW_BURST_GAP_MS);
      if (opensBurst) {
        current = { startedAt: message.createdAt, respondedAt: null, lastReplyAt: null };
        bursts.push(current);
      }
    } else if (current) {
      current.respondedAt ??= message.createdAt;
      current.lastReplyAt = message.createdAt;
    }
    previous = message;
  }
  return bursts;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function percent(part: number, total: number): number | null {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

export async function computeLeadMetrics(leadId: string, now = new Date()): Promise<ComputedLeadMetrics | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      temperature: true,
      statusFlow: true,
      status: { select: { slaHours: true } },
      conversation: { select: { id: true } },
    },
  });
  if (!lead) return null;

  const windowStart = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);
  const monthStart = new Date(now.getTime() - MONTH_DAYS * DAY_MS);

  const [messages, paidProposals, openProposals, wonCount, lostCount] = await Promise.all([
    lead.conversation
      ? prisma.message.findMany({
          where: { conversationId: lead.conversation.id, createdAt: { gte: windowStart } },
          select: { fromMe: true, createdAt: true },
          orderBy: { createdAt: "asc" },
          take: MAX_MESSAGES_READ,
        })
      : Promise.resolve([] as TimedMessage[]),
    prisma.forgeProposal.count({ where: { clientId: leadId, status: "PAGA" } }),
    prisma.forgeProposal.count({ where: { clientId: leadId, status: { in: ["ENVIADA", "VISUALIZADA"] } } }),
    prisma.leadHistory.count({ where: { leadId, action: "WON" } }),
    prisma.leadHistory.count({ where: { leadId, action: "LOST" } }),
  ]);

  const bursts = toBursts(messages);
  const slaMs = (lead.status?.slaHours ?? DEFAULT_SLA_HOURS) * HOUR_MS;
  const answered = bursts.filter((burst) => burst.respondedAt);
  // Rajada ainda dentro do prazo não conta como perdida: o atendente pode responder.
  const expired = bursts.filter(
    (burst) => burst.respondedAt || now.getTime() - burst.startedAt.getTime() > LOSS_THRESHOLD_MS,
  );
  const lost = expired.filter(
    (burst) =>
      !burst.respondedAt || burst.respondedAt.getTime() - burst.startedAt.getTime() > LOSS_THRESHOLD_MS,
  );
  const withinSla = answered.filter(
    (burst) => burst.respondedAt!.getTime() - burst.startedAt.getTime() <= slaMs,
  );

  const monthMessages = messages.filter((message) => message.createdAt >= monthStart);
  const inboundLast30Days = monthMessages.filter((message) => !message.fromMe).length;
  const interactionLossRate = percent(lost.length, expired.length) ?? 0;
  const purchasesCount = Math.max(paidProposals, wonCount);

  const resolvedCycles = wonCount + (lead.statusFlow === "FINISHED" ? 1 : 0);
  const purchasePotential = computePurchasePotential({
    temperature: lead.temperature,
    messagesLast30Days: monthMessages.length,
    inboundLast30Days,
    openProposals,
    purchasesCount,
    interactionLossRate,
  });

  return {
    purchasePotential,
    interestLevel: toInterestLevel(purchasePotential),
    purchasesCount,
    interactionsPerMonth: monthMessages.length,
    avgAttendanceSeconds: average(
      answered.map((burst) => Math.round((burst.lastReplyAt!.getTime() - burst.startedAt.getTime()) / 1000)),
    ),
    interactionLossRate,
    avgResponseSeconds: average(
      answered.map((burst) => Math.round((burst.respondedAt!.getTime() - burst.startedAt.getTime()) / 1000)),
    ),
    qualityScore: percent(withinSla.length, answered.length),
    resolutionRate: percent(resolvedCycles, resolvedCycles + lostCount),
    confidence: computeConfidence({
      totalMessages: messages.length,
      inboundLast30Days,
      openProposals,
      purchasesCount,
    }),
    totalMessages: messages.length,
  };
}
