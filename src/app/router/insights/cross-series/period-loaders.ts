import prisma from "@/lib/prisma";
import { leadWhereOf, trackingWhereOf, type CrossScope } from "./cross-scope";

/** Cada série por período devolve datas (e valores, quando não é contagem) dentro do intervalo da série. */

export interface DatedValue {
  date: Date | null;
  value?: number;
}

type PeriodLoader = (scope: CrossScope) => Promise<DatedValue[]>;

const CENTS_PER_REAL = 100;
const CATALOG_PAID_STATUSES = ["PAID", "IN_LOGISTICS", "DELIVERED"];

function conversationWhereOf(scope: CrossScope) {
  const hasLeadFilters = Boolean(scope.tagIds || scope.memberIds);
  return {
    tracking: { organizationId: { in: scope.organizationIds } },
    ...trackingWhereOf(scope),
    ...(hasLeadFilters ? { lead: leadWhereOf(scope) } : {}),
  };
}

async function loadClosedLeads(scope: CrossScope, outcome: "WON" | "LOST") {
  return prisma.lead.findMany({
    where: { ...leadWhereOf(scope), currentAction: outcome, closedAt: scope.range },
    select: { closedAt: true, amount: true },
  });
}

async function loadPaidEntries(scope: CrossScope, entryType: "RECEIVABLE" | "PAYABLE") {
  const entries = await prisma.paymentEntry.findMany({
    where: {
      organizationId: { in: scope.organizationIds },
      type: entryType,
      status: "PAID",
      paidAt: scope.range,
      ...(scope.paymentAccountIds ? { accountId: { in: scope.paymentAccountIds } } : {}),
      ...(scope.paymentCategoryIds ? { categoryId: { in: scope.paymentCategoryIds } } : {}),
    },
    select: { paidAt: true, paidAmount: true },
  });
  return entries.map((entry) => ({ date: entry.paidAt, value: entry.paidAmount / CENTS_PER_REAL }));
}

async function loadPaidCatalogOrders(scope: CrossScope) {
  return prisma.catalogOrder.findMany({
    where: {
      organizationId: { in: scope.organizationIds },
      status: { in: CATALOG_PAID_STATUSES as never },
      paidAt: scope.range,
      ...trackingWhereOf(scope),
      ...(scope.tagIds ? { lead: { leadTags: { some: { tagId: { in: scope.tagIds } } } } } : {}),
    },
    select: { paidAt: true, total: true },
  });
}

export const PERIOD_LOADERS: Record<string, PeriodLoader> = {
  "ts-leads-created": async (scope) =>
    (await prisma.lead.findMany({ where: { ...leadWhereOf(scope), createdAt: scope.range }, select: { createdAt: true } }))
      .map((lead) => ({ date: lead.createdAt })),
  "ts-leads-won": async (scope) => (await loadClosedLeads(scope, "WON")).map((lead) => ({ date: lead.closedAt })),
  "ts-leads-lost": async (scope) => (await loadClosedLeads(scope, "LOST")).map((lead) => ({ date: lead.closedAt })),
  "ts-won-amount": async (scope) =>
    (await loadClosedLeads(scope, "WON")).map((lead) => ({ date: lead.closedAt, value: Number(lead.amount) })),
  "ts-messages-in": async (scope) =>
    (await prisma.message.findMany({
      where: { fromMe: false, createdAt: scope.range, conversation: conversationWhereOf(scope) },
      select: { createdAt: true },
    })).map((message) => ({ date: message.createdAt })),
  "ts-messages-out": async (scope) =>
    (await prisma.message.findMany({
      where: { fromMe: true, createdAt: scope.range, conversation: conversationWhereOf(scope) },
      select: { createdAt: true },
    })).map((message) => ({ date: message.createdAt })),
  "ts-proposals-created": async (scope) =>
    (await prisma.forgeProposal.findMany({
      where: {
        organizationId: { in: scope.organizationIds },
        createdAt: scope.range,
        ...(scope.memberIds ? { responsibleId: { in: scope.memberIds } } : {}),
      },
      select: { createdAt: true },
    })).map((proposal) => ({ date: proposal.createdAt })),
  // Sem data de pagamento no schema: `updatedAt` da proposta PAGA é o melhor indicador do dia em que pagou.
  "ts-proposals-paid": async (scope) =>
    (await prisma.forgeProposal.findMany({
      where: {
        organizationId: { in: scope.organizationIds },
        status: "PAGA",
        updatedAt: scope.range,
        ...(scope.memberIds ? { responsibleId: { in: scope.memberIds } } : {}),
      },
      select: { updatedAt: true },
    })).map((proposal) => ({ date: proposal.updatedAt })),
  "ts-appointments": async (scope) =>
    (await prisma.appointment.findMany({
      where: { agenda: { organizationId: { in: scope.organizationIds } }, startsAt: scope.range, ...trackingWhereOf(scope) },
      select: { startsAt: true },
    })).map((appointment) => ({ date: appointment.startsAt })),
  "ts-form-responses": async (scope) =>
    (await prisma.formResponses.findMany({
      where: { form: { organizationId: { in: scope.organizationIds } }, createdAt: scope.range },
      select: { createdAt: true },
    })).map((response) => ({ date: response.createdAt })),
  "ts-revenue": (scope) => loadPaidEntries(scope, "RECEIVABLE"),
  "ts-expense": (scope) => loadPaidEntries(scope, "PAYABLE"),
  "ts-campaign-sent": async (scope) =>
    (await prisma.broadcastRecipient.findMany({
      where: { broadcast: { organizationId: { in: scope.organizationIds }, ...trackingWhereOf(scope) }, sentAt: scope.range },
      select: { sentAt: true },
    })).map((recipient) => ({ date: recipient.sentAt })),
  "ts-campaign-read": async (scope) =>
    (await prisma.broadcastRecipient.findMany({
      where: { broadcast: { organizationId: { in: scope.organizationIds }, ...trackingWhereOf(scope) }, readAt: scope.range },
      select: { readAt: true },
    })).map((recipient) => ({ date: recipient.readAt })),
  "ts-trafego-budget": async (scope) =>
    (await prisma.trafegoOrder.findMany({
      where: { organizationId: { in: scope.organizationIds }, createdAt: scope.range },
      select: { createdAt: true, adBudgetBrlCents: true },
    })).map((order) => ({ date: order.createdAt, value: order.adBudgetBrlCents / CENTS_PER_REAL })),
  "ts-nerp-paid": async (scope) => (await loadPaidCatalogOrders(scope)).map((order) => ({ date: order.paidAt })),
  "ts-nerp-revenue": async (scope) =>
    (await loadPaidCatalogOrders(scope)).map((order) => ({ date: order.paidAt, value: Number(order.total) })),
  "ts-loyalty-earned": async (scope) =>
    (await prisma.loyaltyLedgerEntry.findMany({
      where: { organizationId: { in: scope.organizationIds }, type: "EARN", createdAt: scope.range },
      select: { createdAt: true, stars: true },
    })).map((entry) => ({ date: entry.createdAt, value: entry.stars })),
  "ts-loyalty-redemptions": async (scope) =>
    (await prisma.loyaltyRedemption.findMany({
      where: { organizationId: { in: scope.organizationIds }, createdAt: scope.range },
      select: { createdAt: true },
    })).map((redemption) => ({ date: redemption.createdAt })),
  "ts-actions-done": async (scope) =>
    (await prisma.action.findMany({
      where: {
        organizationId: { in: scope.organizationIds },
        isDone: true,
        closedAt: scope.range,
        ...trackingWhereOf(scope),
        ...(scope.workspaceIds ? { workspaceId: { in: scope.workspaceIds } } : {}),
        ...(scope.memberIds ? { responsibles: { some: { userId: { in: scope.memberIds } } } } : {}),
      },
      select: { closedAt: true },
    })).map((action) => ({ date: action.closedAt })),
  "ts-linnker-scans": async (scope) =>
    (await prisma.linnkerScan.findMany({
      where: { page: { organizationId: { in: scope.organizationIds } }, createdAt: scope.range },
      select: { createdAt: true },
    })).map((scan) => ({ date: scan.createdAt })),
  "ts-posts-published": async (scope) =>
    (await prisma.nasaPlannerPost.findMany({
      where: { organizationId: { in: scope.organizationIds }, status: "PUBLISHED", publishedAt: scope.range },
      select: { publishedAt: true },
    })).map((post) => ({ date: post.publishedAt })),
  "ts-stars-consumed": async (scope) =>
    (await prisma.starTransaction.findMany({
      where: { organizationId: { in: scope.organizationIds }, type: "APP_CHARGE", createdAt: scope.range },
      select: { createdAt: true, amount: true },
    })).map((charge) => ({ date: charge.createdAt, value: Math.abs(charge.amount) })),
};
