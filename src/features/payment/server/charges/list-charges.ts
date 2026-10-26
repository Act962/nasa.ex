import "server-only";

import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { startOfTodayInBrasilia } from "@/features/payment/server/entries/lead-credit-status";
import { getOpenAmountCents } from "./charge-details";

// Visão "Cobranças" (spec 0115, RF-16): contas a receber com cliente, com o status do
// pagamento e o do envio dos avisos. Conta em aberto já vencida entra como atrasada mesmo
// antes do cron diário gravar OVERDUE.

export type ChargeStatusFilter = "all" | "open" | "overdue" | "paid" | "cancelled";
export type ChargeChannelFilter = "all" | "WHATSAPP" | "EMAIL" | "none";
export type ChargeDisplayStatus = "OPEN" | "OVERDUE" | "PAID" | "CANCELLED" | "AWAITING_APPROVAL";

export interface ListChargesInput {
  organizationId: string;
  dateFrom?: string;
  dateTo?: string;
  categoryIds?: string[];
  status: ChargeStatusFilter;
  channel: ChargeChannelFilter;
  search?: string;
  page: number;
  perPage: number;
}

const OPEN_STATUSES = ["PENDING", "PARTIAL", "OVERDUE"] as const;

/** Teto da leitura que agrupa as parcelas antes de paginar; acima disso a lista corta. */
const MAX_GROUPING_ROWS = 5000;

const CHARGE_SELECT = {
  id: true,
  description: true,
  amount: true,
  paidAmount: true,
  dueDate: true,
  paidAt: true,
  status: true,
  installmentCurrent: true,
  installmentTotal: true,
  installmentGroupId: true,
  dunningPausedUntil: true,
  contact: { select: { id: true, name: true, email: true, phone: true } },
  lead: { select: { id: true, name: true, email: true, phone: true } },
  dunningRule: {
    select: {
      id: true,
      name: true,
      isActive: true,
      steps: { where: { enabled: true }, select: { channel: true } },
    },
  },
  dunningExecutions: {
    where: { status: { in: ["SENT", "FAILED"] } },
    orderBy: { executedAt: "desc" },
    take: 1,
    select: { status: true, channel: true, executedAt: true, errorMessage: true, deliveredAt: true, readAt: true },
  },
} satisfies Prisma.PaymentEntrySelect;

type ChargeEntry = Prisma.PaymentEntryGetPayload<{ select: typeof CHARGE_SELECT }>;

function buildOverdueWhere(startOfToday: Date): Prisma.PaymentEntryWhereInput {
  return {
    OR: [
      { status: "OVERDUE" },
      { status: { in: ["PENDING", "PARTIAL"] }, dueDate: { lt: startOfToday } },
    ],
  };
}

function buildStatusWhere(status: ChargeStatusFilter, startOfToday: Date): Prisma.PaymentEntryWhereInput {
  switch (status) {
    case "open":
      return { status: { in: ["PENDING", "PARTIAL"] }, dueDate: { gte: startOfToday } };
    case "overdue":
      return buildOverdueWhere(startOfToday);
    case "paid":
      return { status: "PAID" };
    case "cancelled":
      return { status: "CANCELLED" };
    case "all":
      return {};
  }
}

function buildChannelWhere(channel: ChargeChannelFilter): Prisma.PaymentEntryWhereInput {
  if (channel === "all") return {};
  if (channel === "none") return { dunningRuleId: null };
  return { dunningRule: { steps: { some: { channel, enabled: true } } } };
}

function buildPeriodWhere(input: ListChargesInput): Prisma.PaymentEntryWhereInput {
  // Atrasada de meses anteriores continua sendo dinheiro a cobrar: nesse filtro o
  // início do período não esconde nada.
  const dateFrom = input.status === "overdue" ? undefined : input.dateFrom;
  if (!dateFrom && !input.dateTo) return {};
  return {
    dueDate: {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(input.dateTo ? { lte: new Date(input.dateTo) } : {}),
    },
  };
}

function resolveDisplayStatus(
  entry: { status: string; dueDate: Date },
  startOfToday: Date,
): ChargeDisplayStatus {
  if (entry.status === "PAID") return "PAID";
  if (entry.status === "CANCELLED") return "CANCELLED";
  if (entry.status === "PENDING_APPROVAL") return "AWAITING_APPROVAL";
  if (entry.status === "OVERDUE" || entry.dueDate < startOfToday) return "OVERDUE";
  return "OPEN";
}

function sumOpenCents(aggregate: { _sum: { amount: number | null; paidAmount: number | null } }): number {
  return Math.max((aggregate._sum.amount ?? 0) - (aggregate._sum.paidAmount ?? 0), 0);
}

export async function listCharges(input: ListChargesInput) {
  const startOfToday = startOfTodayInBrasilia(new Date());
  const search = input.search?.trim();

  const baseWhere: Prisma.PaymentEntryWhereInput = {
    organizationId: input.organizationId,
    type: "RECEIVABLE",
    OR: [{ contactId: { not: null } }, { leadId: { not: null } }],
    ...(input.categoryIds?.length ? { categoryId: { in: input.categoryIds } } : {}),
  };
  const periodWhere: Prisma.PaymentEntryWhereInput = {
    AND: [baseWhere, buildPeriodWhere({ ...input, status: "all" })],
  };
  const listWhere: Prisma.PaymentEntryWhereInput = {
    AND: [
      baseWhere,
      buildPeriodWhere(input),
      buildStatusWhere(input.status, startOfToday),
      buildChannelWhere(input.channel),
      search
        ? {
            OR: [
              { description: { contains: search, mode: "insensitive" } },
              { contact: { name: { contains: search, mode: "insensitive" } } },
              { lead: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {},
    ],
  };

  // Parcelas da mesma série viram uma linha só: a paginação conta cobranças, não parcelas.
  const [matches, periodAggregate, paidAggregate, openAggregate, overdueAggregate] = await Promise.all([
    prisma.paymentEntry.findMany({
      where: listWhere,
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      select: { id: true, installmentGroupId: true },
      take: MAX_GROUPING_ROWS,
    }),
    prisma.paymentEntry.aggregate({
      where: { AND: [periodWhere, { status: { not: "CANCELLED" } }] },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.paymentEntry.aggregate({
      where: { AND: [periodWhere, { status: "PAID" }] },
      _count: { _all: true },
      _sum: { paidAmount: true },
    }),
    prisma.paymentEntry.aggregate({
      where: {
        AND: [periodWhere, { status: { in: ["PENDING", "PARTIAL"] }, dueDate: { gte: startOfToday } }],
      },
      _count: { _all: true },
      _sum: { amount: true, paidAmount: true },
    }),
    // Igual ao filtro "Atrasadas": todas as vencidas até o fim do período, de qualquer mês.
    prisma.paymentEntry.aggregate({
      where: {
        AND: [
          baseWhere,
          buildPeriodWhere({ ...input, status: "overdue" }),
          buildOverdueWhere(startOfToday),
        ],
      },
      _count: { _all: true },
      _sum: { amount: true, paidAmount: true },
    }),
  ]);

  const matchIdsByRow = new Map<string, Set<string>>();
  for (const match of matches) {
    const rowKey = match.installmentGroupId ?? match.id;
    const ids = matchIdsByRow.get(rowKey) ?? new Set<string>();
    ids.add(match.id);
    matchIdsByRow.set(rowKey, ids);
  }
  const pageRowKeys = [...matchIdsByRow.keys()].slice((input.page - 1) * input.perPage, input.page * input.perPage);
  const groupIds = pageRowKeys.filter((rowKey) => !matchIdsByRow.get(rowKey)?.has(rowKey));
  const singleIds = pageRowKeys.filter((rowKey) => matchIdsByRow.get(rowKey)?.has(rowKey));

  // A série inteira vem, inclusive parcelas fora do período: a área recolhida mostra todas.
  const pageEntries = pageRowKeys.length
    ? await prisma.paymentEntry.findMany({
        where: {
          organizationId: input.organizationId,
          type: "RECEIVABLE",
          OR: [{ id: { in: singleIds } }, { installmentGroupId: { in: groupIds } }],
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        select: CHARGE_SELECT,
      })
    : [];

  const toChargeRow = (entry: ChargeEntry) => {
    const customer = entry.contact ?? entry.lead;
    const channels = [...new Set(entry.dunningRule?.steps.map((step) => step.channel) ?? [])];
    const lastNotice = entry.dunningExecutions[0] ?? null;
    return {
      id: entry.id,
      description: entry.description,
      amountCents: entry.amount,
      openAmountCents: getOpenAmountCents(entry),
      dueDate: entry.dueDate,
      paidAt: entry.paidAt,
      status: resolveDisplayStatus(entry, startOfToday),
      isPartial: entry.paidAmount > 0 && entry.status !== "PAID",
      installmentLabel:
        entry.installmentTotal && entry.installmentTotal > 1
          ? `${entry.installmentCurrent ?? 1}/${entry.installmentTotal}`
          : null,
      customer: customer
        ? { name: customer.name, email: customer.email, phone: customer.phone }
        : null,
      rule: entry.dunningRule
        ? { id: entry.dunningRule.id, name: entry.dunningRule.name, isActive: entry.dunningRule.isActive }
        : null,
      channels: channels.filter((channel) => channel !== "SMS"),
      lastNotice: lastNotice?.executedAt
        ? {
            status: lastNotice.status as "SENT" | "FAILED",
            channel: lastNotice.channel,
            executedAt: lastNotice.executedAt,
            errorMessage: lastNotice.errorMessage,
            deliveredAt: lastNotice.deliveredAt,
            readAt: lastNotice.readAt,
          }
        : null,
      isOpen: (OPEN_STATUSES as readonly string[]).includes(entry.status),
      dunningPausedUntil:
        entry.dunningPausedUntil && entry.dunningPausedUntil.getTime() > Date.now() ? entry.dunningPausedUntil : null,
    };
  };

  const charges = pageRowKeys.flatMap((rowKey) => {
    const matchIds = matchIdsByRow.get(rowKey) ?? new Set<string>();
    if (matchIds.has(rowKey)) {
      const entry = pageEntries.find((candidate) => candidate.id === rowKey);
      return entry ? [{ ...toChargeRow(entry), rowKey, group: null, installments: [] }] : [];
    }

    const series = pageEntries
      .filter((candidate) => candidate.installmentGroupId === rowKey)
      .sort((a, b) => (a.installmentCurrent ?? 0) - (b.installmentCurrent ?? 0));
    if (series.length === 0) return [];
    const isOpenEntry = (entry: ChargeEntry) => (OPEN_STATUSES as readonly string[]).includes(entry.status);
    // Em destaque: com "todos os status", a próxima parcela em aberto (ou a última, se a série
    // terminou); com um status filtrado, a primeira parcela que bate com o filtro.
    const headline =
      input.status === "all"
        ? series.find(isOpenEntry) ?? series[series.length - 1]
        : series.find((entry) => matchIds.has(entry.id)) ?? series[0];
    const paid = series.filter((entry) => entry.status === "PAID");
    const open = series.filter(isOpenEntry);
    return [
      {
        ...toChargeRow(headline),
        rowKey,
        group: {
          installmentTotal: headline.installmentTotal ?? series.length,
          paidCount: paid.length,
          openCount: open.length,
          paidAmountCents: series.reduce((sum, entry) => sum + entry.paidAmount, 0),
          openAmountCents: open.reduce((sum, entry) => sum + getOpenAmountCents(entry), 0),
        },
        installments: series.filter((entry) => entry.id !== headline.id).map(toChargeRow),
      },
    ];
  });

  return {
    charges,
    total: matchIdsByRow.size,
    summary: {
      total: { count: periodAggregate._count._all, amountCents: periodAggregate._sum.amount ?? 0 },
      paid: { count: paidAggregate._count._all, amountCents: paidAggregate._sum.paidAmount ?? 0 },
      open: { count: openAggregate._count._all, amountCents: sumOpenCents(openAggregate) },
      overdue: { count: overdueAggregate._count._all, amountCents: sumOpenCents(overdueAggregate) },
    },
  };
}
