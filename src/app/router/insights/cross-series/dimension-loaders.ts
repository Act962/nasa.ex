import prisma from "@/lib/prisma";
import { leadSourceLabel } from "@/features/insights/lib/lead-source-labels";
import type { CrossAxis } from "@/features/insights/lib/cross-chart-catalog";
import { leadWhereOf, type CrossScope } from "./cross-scope";

/** Séries por categoria (atendente, origem, motivo de perda), calculadas com os filtros da própria série. */

interface DataPoint {
  name: string;
  value: number;
}

const HOUR_MS = 1000 * 60 * 60;
const MAX_CATEGORIES = 10;
const NO_ATTENDANT_LABEL = "Sem responsável";
const NO_REASON_LABEL = "Sem motivo";

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function toPercent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

function increment(countsByCategory: Map<string, number>, category: string, amount = 1) {
  countsByCategory.set(category, (countsByCategory.get(category) ?? 0) + amount);
}

function rankedEntries(valuesByCategory: Map<string, number>): DataPoint[] {
  return [...valuesByCategory.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, MAX_CATEGORIES)
    .map(([name, value]) => ({ name, value: roundTwo(value) }));
}

async function loadScopedLeads(scope: CrossScope) {
  return prisma.lead.findMany({
    where: { ...leadWhereOf(scope), createdAt: scope.range },
    select: {
      source: true,
      currentAction: true,
      amount: true,
      createdAt: true,
      firstResponseAt: true,
      responsible: { select: { name: true } },
    },
  });
}

type ScopedLead = Awaited<ReturnType<typeof loadScopedLeads>>[number];

function groupLeadStats(leads: ScopedLead[], categoryOf: (lead: ScopedLead) => string) {
  const statsByCategory = new Map<string, { leads: number; won: number; lost: number; wonAmount: number; responseMs: number[] }>();
  for (const lead of leads) {
    const category = categoryOf(lead);
    const stats = statsByCategory.get(category) ?? { leads: 0, won: 0, lost: 0, wonAmount: 0, responseMs: [] };
    stats.leads += 1;
    if (lead.currentAction === "WON") {
      stats.won += 1;
      stats.wonAmount += Number(lead.amount);
    }
    if (lead.currentAction === "LOST") stats.lost += 1;
    if (lead.firstResponseAt && lead.firstResponseAt > lead.createdAt) {
      stats.responseMs.push(lead.firstResponseAt.getTime() - lead.createdAt.getTime());
    }
    statsByCategory.set(category, stats);
  }
  return statsByCategory;
}

function pickFromStats(
  statsByCategory: ReturnType<typeof groupLeadStats>,
  valueOf: (stats: ReturnType<typeof groupLeadStats> extends Map<string, infer TStats> ? TStats : never) => number,
): DataPoint[] {
  // Ordem das categorias = quem tem mais leads; o valor exibido é o da métrica pedida.
  const orderedCategories = [...statsByCategory.entries()]
    .sort((left, right) => right[1].leads - left[1].leads)
    .slice(0, MAX_CATEGORIES);
  return orderedCategories.map(([name, stats]) => ({ name, value: roundTwo(valueOf(stats)) }));
}

async function loadAttendantDataset(datasetId: string, scope: CrossScope): Promise<DataPoint[]> {
  if (datasetId === "dim-attendant-messages") {
    const outboundMessages = await prisma.message.findMany({
      where: { fromMe: true, createdAt: scope.range, conversation: { lead: leadWhereOf(scope) } },
      select: { conversation: { select: { lead: { select: { responsible: { select: { name: true } } } } } } },
    });
    const messagesByAttendant = new Map<string, number>();
    for (const message of outboundMessages) {
      increment(messagesByAttendant, message.conversation.lead?.responsible?.name ?? NO_ATTENDANT_LABEL);
    }
    return rankedEntries(messagesByAttendant);
  }
  if (datasetId === "dim-attendant-paid-proposals") {
    const paidProposals = await prisma.forgeProposal.findMany({
      where: { organizationId: { in: scope.organizationIds }, status: "PAGA", updatedAt: scope.range },
      select: { responsible: { select: { name: true } } },
    });
    const proposalsByAttendant = new Map<string, number>();
    for (const proposal of paidProposals) increment(proposalsByAttendant, proposal.responsible?.name ?? NO_ATTENDANT_LABEL);
    return rankedEntries(proposalsByAttendant);
  }
  const statsByAttendant = groupLeadStats(
    await loadScopedLeads(scope),
    (lead) => lead.responsible?.name ?? NO_ATTENDANT_LABEL,
  );
  switch (datasetId) {
    case "dim-attendant-won":
      return pickFromStats(statsByAttendant, (stats) => stats.won);
    case "dim-attendant-won-amount":
      return pickFromStats(statsByAttendant, (stats) => stats.wonAmount);
    case "dim-attendant-conversion":
      return pickFromStats(statsByAttendant, (stats) => toPercent(stats.won, stats.won + stats.lost));
    case "dim-attendant-first-response":
      return pickFromStats(statsByAttendant, (stats) =>
        stats.responseMs.length > 0
          ? stats.responseMs.reduce((total, duration) => total + duration, 0) / stats.responseMs.length / HOUR_MS
          : 0,
      );
    default:
      return pickFromStats(statsByAttendant, (stats) => stats.leads);
  }
}

async function loadSourceDataset(datasetId: string, scope: CrossScope): Promise<DataPoint[]> {
  const statsBySource = groupLeadStats(await loadScopedLeads(scope), (lead) => leadSourceLabel(lead.source));
  switch (datasetId) {
    case "dim-source-won":
      return pickFromStats(statsBySource, (stats) => stats.won);
    case "dim-source-lost":
      return pickFromStats(statsBySource, (stats) => stats.lost);
    case "dim-source-won-amount":
      return pickFromStats(statsBySource, (stats) => stats.wonAmount);
    case "dim-source-ticket":
      return pickFromStats(statsBySource, (stats) => (stats.won > 0 ? stats.wonAmount / stats.won : 0));
    case "dim-source-conversion":
      return pickFromStats(statsBySource, (stats) => toPercent(stats.won, stats.won + stats.lost));
    default:
      return pickFromStats(statsBySource, (stats) => stats.leads);
  }
}

async function loadLossDataset(datasetId: string, scope: CrossScope): Promise<DataPoint[]> {
  const lossHistories = await prisma.leadHistory.findMany({
    where: { action: "LOST", createdAt: scope.range, lead: leadWhereOf(scope) },
    select: { reason: { select: { name: true } }, lead: { select: { amount: true } } },
  });
  const lossesByReason = new Map<string, number>();
  const lostAmountByReason = new Map<string, number>();
  for (const history of lossHistories) {
    const reasonName = history.reason?.name ?? NO_REASON_LABEL;
    increment(lossesByReason, reasonName);
    increment(lostAmountByReason, reasonName, Number(history.lead.amount));
  }
  const orderedReasons = rankedEntries(lossesByReason).map((point) => point.name);
  if (datasetId === "dim-loss-amount") {
    return orderedReasons.map((reason) => ({ name: reason, value: roundTwo(lostAmountByReason.get(reason) ?? 0) }));
  }
  if (datasetId === "dim-loss-share") {
    return orderedReasons.map((reason) => ({ name: reason, value: toPercent(lossesByReason.get(reason) ?? 0, lossHistories.length) }));
  }
  return orderedReasons.map((reason) => ({ name: reason, value: lossesByReason.get(reason) ?? 0 }));
}

export function loadDimensionDataset(axis: Exclude<CrossAxis, "period">, datasetId: string, scope: CrossScope) {
  if (axis === "attendant") return loadAttendantDataset(datasetId, scope);
  if (axis === "source") return loadSourceDataset(datasetId, scope);
  return loadLossDataset(datasetId, scope);
}
