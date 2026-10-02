import prisma from "@/lib/prisma";

/** Blocos do Insights para Campanhas, trafeGO, NERP (Catálogo online) e Star Friends. */

interface NewAppsFilters {
  organizationIds: string[];
  createdAtFilter?: { gte: Date; lte: Date };
  trackingId?: string;
  tagIds?: string[];
}

const BROADCAST_DONE_STATUSES = ["SENT", "SENDING"] as const;
const CATALOG_PAID_STATUSES = ["PAID", "IN_LOGISTICS", "DELIVERED"] as const;
const TRAFEGO_ACTIVE_STATUSES = ["SCHEDULED", "RUNNING"] as const;
const CENTS_PER_REAL = 100;

function toPercent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

async function loadCampaignsInsights({ organizationIds, createdAtFilter, trackingId }: NewAppsFilters) {
  const broadcasts = await prisma.broadcast.findMany({
    where: {
      organizationId: { in: organizationIds },
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      ...(trackingId ? { trackingId } : {}),
    },
    select: { status: true, totalRecipients: true, sentCount: true, deliveredCount: true, readCount: true, failedCount: true },
  });
  const sentCount = broadcasts.reduce((total, broadcast) => total + broadcast.sentCount, 0);
  const deliveredCount = broadcasts.reduce((total, broadcast) => total + broadcast.deliveredCount, 0);
  const readCount = broadcasts.reduce((total, broadcast) => total + broadcast.readCount, 0);
  const failedCount = broadcasts.reduce((total, broadcast) => total + broadcast.failedCount, 0);
  return {
    totalCampaigns: broadcasts.length,
    sentCampaigns: broadcasts.filter((broadcast) =>
      (BROADCAST_DONE_STATUSES as readonly string[]).includes(broadcast.status),
    ).length,
    totalRecipients: broadcasts.reduce((total, broadcast) => total + broadcast.totalRecipients, 0),
    sentCount,
    deliveredCount,
    readCount,
    failedCount,
    deliveryRate: toPercent(deliveredCount, sentCount),
    readRate: toPercent(readCount, deliveredCount),
  };
}

async function loadTrafegoInsights({ organizationIds, createdAtFilter }: NewAppsFilters) {
  const orders = await prisma.trafegoOrder.findMany({
    where: {
      organizationId: { in: organizationIds },
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    },
    select: { status: true, adBudgetBrlCents: true, serviceFeeBrlCents: true, totalBrlCents: true },
  });
  return {
    totalOrders: orders.length,
    activeOrders: orders.filter((order) =>
      (TRAFEGO_ACTIVE_STATUSES as readonly string[]).includes(order.status),
    ).length,
    adBudget: orders.reduce((total, order) => total + order.adBudgetBrlCents, 0) / CENTS_PER_REAL,
    serviceFees: orders.reduce((total, order) => total + order.serviceFeeBrlCents, 0) / CENTS_PER_REAL,
    revenue: orders.reduce((total, order) => total + order.totalBrlCents, 0) / CENTS_PER_REAL,
  };
}

async function loadNerpInsights({ organizationIds, createdAtFilter, trackingId, tagIds }: NewAppsFilters) {
  const orders = await prisma.catalogOrder.findMany({
    where: {
      organizationId: { in: organizationIds },
      ...(tagIds && tagIds.length > 0 ? { lead: { leadTags: { some: { tagId: { in: tagIds } } } } } : {}),
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      ...(trackingId ? { trackingId } : {}),
    },
    select: { status: true, total: true },
  });
  const paidOrders = orders.filter((order) =>
    (CATALOG_PAID_STATUSES as readonly string[]).includes(order.status),
  );
  const paidRevenue = paidOrders.reduce((total, order) => total + Number(order.total), 0);
  return {
    totalOrders: orders.length,
    paidOrders: paidOrders.length,
    canceledOrders: orders.filter((order) => order.status === "CANCELED").length,
    paidRevenue,
    avgTicket: paidOrders.length > 0 ? paidRevenue / paidOrders.length : 0,
    conversionRate: toPercent(paidOrders.length, orders.length),
  };
}

async function loadStarFriendsInsights({ organizationIds, createdAtFilter }: NewAppsFilters) {
  const [newMembers, totalMembers, ledgerEntries, redemptions] = await Promise.all([
    prisma.loyaltyMember.count({
      where: {
        organizationId: { in: organizationIds },
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      },
    }),
    prisma.loyaltyMember.count({ where: { organizationId: { in: organizationIds } } }),
    prisma.loyaltyLedgerEntry.findMany({
      where: {
        organizationId: { in: organizationIds },
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      },
      select: { type: true, stars: true },
    }),
    prisma.loyaltyRedemption.count({
      where: {
        organizationId: { in: organizationIds },
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      },
    }),
  ]);
  const sumStarsOf = (ledgerType: string) =>
    ledgerEntries
      .filter((entry) => entry.type === ledgerType)
      .reduce((total, entry) => total + Math.abs(entry.stars), 0);
  return {
    totalMembers,
    newMembers,
    starsEarned: sumStarsOf("EARN"),
    starsRedeemed: sumStarsOf("REDEEM"),
    starsExpired: sumStarsOf("EXPIRE"),
    redemptions,
  };
}

export async function loadNewAppsInsights(filters: NewAppsFilters) {
  const [campanhas, trafego, nerp, starFriends] = await Promise.all([
    loadCampaignsInsights(filters),
    loadTrafegoInsights(filters),
    loadNerpInsights(filters),
    loadStarFriendsInsights(filters),
  ]);
  return { campanhas, trafego, nerp, starFriends };
}
