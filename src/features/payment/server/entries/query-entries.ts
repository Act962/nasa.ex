import "server-only";

import prisma from "@/lib/prisma";
import { ENTRY_INCLUDE, PENDING_ENTRY_STATUSES } from "./entry-include";

// Lista de lançamentos com totais do filtro inteiro (spec 0012) — a mesma
// query serve a aba de lançamentos e as tools do Astro.

export type PaymentEntryStatusFilter =
  | "PENDING_APPROVAL"
  | "PENDING"
  | "PARTIAL"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export interface QueryPaymentEntriesInput {
  organizationId: string;
  type?: "RECEIVABLE" | "PAYABLE";
  status?: PaymentEntryStatusFilter;
  statuses?: PaymentEntryStatusFilter[];
  contactId?: string;
  contactIds?: string[];
  categoryId?: string;
  categoryIds?: string[];
  accountId?: string;
  accountIds?: string[];
  leadId?: string;
  trackingId?: string;
  dateFrom?: string;
  dateTo?: string;
  paidFrom?: string;
  paidTo?: string;
  amountMinCents?: number;
  amountMaxCents?: number;
  installmentTotal?: number;
  search?: string;
  page?: number;
  perPage?: number;
  orderBy?: "dueDate_asc" | "dueDate_desc";
}

export function buildPaymentEntriesWhere(input: QueryPaymentEntriesInput) {
  return {
    organizationId: input.organizationId,
    ...(input.type ? { type: input.type } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.statuses && input.statuses.length > 0 ? { status: { in: input.statuses } } : {}),
    ...(input.contactId ? { contactId: input.contactId } : {}),
    ...(input.contactIds && input.contactIds.length > 0
      ? { contactId: { in: input.contactIds } }
      : {}),
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.categoryIds && input.categoryIds.length > 0
      ? { categoryId: { in: input.categoryIds } }
      : {}),
    ...(input.accountId ? { accountId: input.accountId } : {}),
    ...(input.accountIds && input.accountIds.length > 0
      ? { accountId: { in: input.accountIds } }
      : {}),
    ...(input.leadId ? { leadId: input.leadId } : {}),
    ...(input.trackingId ? { trackingId: input.trackingId } : {}),
    ...(typeof input.installmentTotal === "number"
      ? { installmentTotal: input.installmentTotal }
      : {}),
    // A busca cobre os campos que o usuário enxerga na linha.
    ...(input.search
      ? {
          OR: [
            { description: { contains: input.search, mode: "insensitive" as const } },
            { documentNumber: { contains: input.search, mode: "insensitive" as const } },
            { notes: { contains: input.search, mode: "insensitive" as const } },
            { contact: { name: { contains: input.search, mode: "insensitive" as const } } },
            { category: { name: { contains: input.search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
    ...(input.dateFrom || input.dateTo
      ? {
          dueDate: {
            ...(input.dateFrom ? { gte: new Date(input.dateFrom) } : {}),
            ...(input.dateTo ? { lte: new Date(input.dateTo) } : {}),
          },
        }
      : {}),
    ...(input.paidFrom || input.paidTo
      ? {
          paidAt: {
            ...(input.paidFrom ? { gte: new Date(input.paidFrom) } : {}),
            ...(input.paidTo ? { lte: new Date(input.paidTo) } : {}),
          },
        }
      : {}),
    ...(typeof input.amountMinCents === "number" || typeof input.amountMaxCents === "number"
      ? {
          amount: {
            ...(typeof input.amountMinCents === "number" ? { gte: input.amountMinCents } : {}),
            ...(typeof input.amountMaxCents === "number" ? { lte: input.amountMaxCents } : {}),
          },
        }
      : {}),
  };
}

export async function queryPaymentEntries(input: QueryPaymentEntriesInput) {
  const where = buildPaymentEntriesWhere(input);
  const page = input.page ?? 1;
  const perPage = input.perPage ?? 50;

  const [entries, total, amountAggregate, pendingAggregate] = await Promise.all([
    prisma.paymentEntry.findMany({
      where,
      include: ENTRY_INCLUDE,
      orderBy: { dueDate: input.orderBy === "dueDate_desc" ? "desc" : "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.paymentEntry.count({ where }),
    prisma.paymentEntry.aggregate({ where, _sum: { amount: true, paidAmount: true } }),
    // AND (em vez de espalhar `where`): se o usuário já filtrou por um status,
    // o somatório precisa respeitar esse filtro em vez de sobrescrevê-lo.
    prisma.paymentEntry.aggregate({
      where: { AND: [where, { status: { in: [...PENDING_ENTRY_STATUSES] } }] },
      _sum: { amount: true },
    }),
  ]);

  return {
    entries,
    total,
    totals: {
      amount: amountAggregate._sum.amount ?? 0,
      paidAmount: amountAggregate._sum.paidAmount ?? 0,
      pendingAmount: pendingAggregate._sum.amount ?? 0,
    },
  };
}
