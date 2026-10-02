import prisma from "@/lib/prisma";
import { leadSourceLabel } from "@/features/insights/lib/lead-source-labels";

/** Indicadores de prioridade alta do Insights que não cabiam no carregamento original de cada App. */

interface KpiExtrasFilters {
  organizationIds: string[];
  createdAtFilter?: { gte: Date; lte: Date };
  trackingId?: string;
  tagIds?: string[];
  workspaceIds?: string[];
}

interface RankingItem {
  name: string;
  value: number;
}

const HOUR_MS = 1000 * 60 * 60;
const DAY_MS = HOUR_MS * 24;
const UNANSWERED_THRESHOLD_MS = DAY_MS;
const STARS_CONSUMPTION_WINDOW_DAYS = 30;
const RANKING_SIZE = 5;
const CENTS_PER_REAL = 100;
const SENT_PROPOSAL_STATUSES = ["ENVIADA", "VISUALIZADA", "PAGA", "EXPIRADA", "CANCELADA"];
const CATALOG_PAID_STATUSES = ["PAID", "IN_LOGISTICS", "DELIVERED"];

function toPercent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

function averageHours(durationsMs: number[]): number {
  if (durationsMs.length === 0) return 0;
  return durationsMs.reduce((total, durationMs) => total + durationMs, 0) / durationsMs.length / HOUR_MS;
}

function toRanking(countsByName: Map<string, number>): RankingItem[] {
  return [...countsByName.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, RANKING_SIZE);
}

function addTo(countsByName: Map<string, number>, name: string, amount = 1) {
  countsByName.set(name, (countsByName.get(name) ?? 0) + amount);
}

async function loadTrackingExtras({ organizationIds, createdAtFilter, trackingId, tagIds }: KpiExtrasFilters) {
  const leadScope = {
    tracking: { organizationId: { in: organizationIds } },
    ...(trackingId ? { trackingId } : {}),
    ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    ...(tagIds && tagIds.length > 0 ? { leadTags: { some: { tagId: { in: tagIds } } } } : {}),
  };
  const [leads, lossHistories] = await Promise.all([
    prisma.lead.findMany({
      where: { ...leadScope, currentAction: { not: "DELETED" } },
      select: { source: true, currentAction: true, amount: true },
    }),
    prisma.leadHistory.findMany({
      where: { action: "LOST", reasonId: { not: null }, lead: leadScope },
      select: { reason: { select: { name: true } } },
    }),
  ]);
  const wonLeads = leads.filter((lead) => lead.currentAction === "WON");
  const lostLeads = leads.filter((lead) => lead.currentAction === "LOST");
  const leadsBySource = new Map<string, number>();
  for (const lead of leads) addTo(leadsBySource, leadSourceLabel(lead.source));
  const lossReasons = new Map<string, number>();
  for (const history of lossHistories) if (history.reason) addTo(lossReasons, history.reason.name);
  return {
    conversionRate: toPercent(wonLeads.length, wonLeads.length + lostLeads.length),
    wonAmount: wonLeads.reduce((total, lead) => total + Number(lead.amount), 0),
    pipelineAmount: leads
      .filter((lead) => lead.currentAction === "ACTIVE")
      .reduce((total, lead) => total + Number(lead.amount), 0),
    leadsBySource: toRanking(leadsBySource),
    lossReasons: toRanking(lossReasons),
  };
}

async function loadChatExtras({ organizationIds, createdAtFilter, trackingId }: KpiExtrasFilters) {
  const now = Date.now();
  const conversations = await prisma.conversation.findMany({
    where: {
      tracking: { organizationId: { in: organizationIds } },
      ...(trackingId ? { trackingId } : {}),
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    },
    select: {
      firstUserMessageAt: true,
      lead: { select: { firstResponseAt: true, lastInboundAt: true, lastOutboundAt: true } },
    },
  });
  const firstResponseDurations = conversations.flatMap((conversation) => {
    const askedAt = conversation.firstUserMessageAt;
    const answeredAt = conversation.lead?.firstResponseAt;
    return askedAt && answeredAt && answeredAt > askedAt ? [answeredAt.getTime() - askedAt.getTime()] : [];
  });
  const unansweredOver24h = conversations.filter((conversation) => {
    const lastInboundAt = conversation.lead?.lastInboundAt;
    const lastOutboundAt = conversation.lead?.lastOutboundAt;
    if (!lastInboundAt) return false;
    const isAwaitingReply = !lastOutboundAt || lastOutboundAt < lastInboundAt;
    return isAwaitingReply && now - lastInboundAt.getTime() > UNANSWERED_THRESHOLD_MS;
  }).length;
  return { avgFirstResponse: averageHours(firstResponseDurations), unansweredOver24h };
}

async function loadForgeExtras({ organizationIds, createdAtFilter }: KpiExtrasFilters) {
  const [proposals, activeContracts] = await Promise.all([
    prisma.forgeProposal.findMany({
      where: {
        organizationId: { in: organizationIds },
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      },
      select: {
        status: true,
        clientId: true,
        responsible: { select: { name: true } },
        products: { select: { unitValue: true, quantity: true, discount: true } },
      },
    }),
    prisma.forgeContract.findMany({
      where: { organizationId: { in: organizationIds }, status: "ATIVO" },
      select: { value: true },
    }),
  ]);
  const sentProposals = proposals.filter((proposal) => SENT_PROPOSAL_STATUSES.includes(proposal.status));
  const paidProposals = proposals.filter((proposal) => proposal.status === "PAGA");
  const revenueBySeller = new Map<string, number>();
  for (const proposal of paidProposals) {
    const proposalValue = proposal.products.reduce(
      (total, product) =>
        total + Number(product.unitValue) * Number(product.quantity ?? 1) - Number(product.discount ?? 0),
      0,
    );
    addTo(revenueBySeller, proposal.responsible?.name ?? "Sem responsável", proposalValue);
  }
  return {
    closeRate: toPercent(paidProposals.length, sentProposals.length),
    // Leads distintos com ao menos uma proposta paga — base do cruzamento "leads → proposta paga".
    leadsWithPaidProposal: new Set(paidProposals.flatMap((proposal) => (proposal.clientId ? [proposal.clientId] : []))).size,
    topSellers: toRanking(revenueBySeller),
    activeContractsValue: activeContracts.reduce((total, contract) => total + Number(contract.value ?? 0), 0),
  };
}

async function loadSpacetimeExtras({ organizationIds, createdAtFilter, trackingId }: KpiExtrasFilters) {
  const appointmentsWithLead = await prisma.appointment.findMany({
    where: {
      agenda: { organizationId: { in: organizationIds } },
      ...(trackingId ? { trackingId } : {}),
      leadId: { not: null },
      ...(createdAtFilter ? { startsAt: createdAtFilter } : {}),
    },
    select: { lead: { select: { currentAction: true } } },
  });
  const wonAfterAppointment = appointmentsWithLead.filter(
    (appointment) => appointment.lead?.currentAction === "WON",
  ).length;
  return { appointmentToSaleRate: toPercent(wonAfterAppointment, appointmentsWithLead.length) };
}

async function loadPlannerExtras({ organizationIds, createdAtFilter }: KpiExtrasFilters) {
  const publishedPosts = await prisma.nasaPlannerPost.findMany({
    where: {
      organizationId: { in: organizationIds },
      status: "PUBLISHED",
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    },
    select: { metricsReach: true, metricsLikes: true, metricsComments: true, metricsShares: true },
  });
  const totalReach = publishedPosts.reduce((total, post) => total + (post.metricsReach ?? 0), 0);
  const totalInteractions = publishedPosts.reduce(
    (total, post) => total + (post.metricsLikes ?? 0) + (post.metricsComments ?? 0) + (post.metricsShares ?? 0),
    0,
  );
  return { totalReach, engagementRate: toPercent(totalInteractions, totalReach) };
}

async function loadWorkspaceExtras({ organizationIds, createdAtFilter, trackingId, workspaceIds }: KpiExtrasFilters) {
  const doneWithDeadline = await prisma.action.findMany({
    where: {
      organizationId: { in: organizationIds },
      ...(trackingId ? { trackingId } : {}),
      ...(workspaceIds && workspaceIds.length > 0 ? { workspaceId: { in: workspaceIds } } : {}),
      isArchived: false,
      isDone: true,
      dueDate: { not: null },
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    },
    select: { dueDate: true, closedAt: true },
  });
  const deliveredOnTime = doneWithDeadline.filter(
    (action) => action.closedAt && action.dueDate && action.closedAt <= action.dueDate,
  ).length;
  return { onTimeRate: toPercent(deliveredOnTime, doneWithDeadline.length) };
}

async function loadFormsExtras({ organizationIds, createdAtFilter }: KpiExtrasFilters) {
  const [forms, responsesWithLead] = await Promise.all([
    prisma.form.findMany({
      where: { organizationId: { in: organizationIds } },
      select: { views: true, responses: true },
    }),
    prisma.formResponses.findMany({
      where: {
        form: { organizationId: { in: organizationIds } },
        leadId: { not: null },
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      },
      select: { lead: { select: { currentAction: true } } },
    }),
  ]);
  const totalViews = forms.reduce((total, form) => total + (form.views ?? 0), 0);
  const totalResponses = forms.reduce((total, form) => total + (form.responses ?? 0), 0);
  const wonFromForms = responsesWithLead.filter((response) => response.lead?.currentAction === "WON").length;
  return {
    viewToResponseRate: toPercent(totalResponses, totalViews),
    formLeadsWonRate: toPercent(wonFromForms, responsesWithLead.length),
  };
}

async function loadPaymentExtras({ organizationIds, createdAtFilter }: KpiExtrasFilters) {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [entries, monthRevenueEntries, monthGoals, taxAssessments, overdueObligations] = await Promise.all([
    prisma.paymentEntry.findMany({
      where: {
        organizationId: { in: organizationIds },
        status: { not: "CANCELLED" },
        ...(createdAtFilter ? { dueDate: createdAtFilter } : {}),
      },
      select: { type: true, status: true, amount: true, paidAmount: true, dueDate: true, category: { select: { name: true } } },
    }),
    prisma.paymentEntry.findMany({
      where: { organizationId: { in: organizationIds }, type: "RECEIVABLE", status: "PAID", paidAt: { gte: monthStart } },
      select: { paidAmount: true },
    }),
    prisma.paymentGoalMonth.findMany({
      where: { organizationId: { in: organizationIds }, year: today.getFullYear(), month: today.getMonth() + 1 },
      select: { revenueTargetCents: true },
    }),
    prisma.taxAssessment.findMany({
      where: {
        organizationId: { in: organizationIds },
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      },
      select: { amountCents: true },
    }),
    prisma.fiscalObligation.count({ where: { organizationId: { in: organizationIds }, status: "OVERDUE" } }),
  ]);
  const paidEntries = entries.filter((entry) => entry.status === "PAID");
  const revenue = paidEntries.filter((entry) => entry.type === "RECEIVABLE").reduce((total, entry) => total + entry.paidAmount, 0);
  const expense = paidEntries.filter((entry) => entry.type === "PAYABLE").reduce((total, entry) => total + entry.paidAmount, 0);
  const openReceivables = entries.filter(
    (entry) => entry.type === "RECEIVABLE" && ["PENDING", "PARTIAL", "OVERDUE"].includes(entry.status),
  );
  const overdueReceivables = openReceivables.filter(
    (entry) => entry.status === "OVERDUE" || entry.dueDate < today,
  );
  const expenseByCategory = new Map<string, number>();
  for (const entry of paidEntries.filter((paidEntry) => paidEntry.type === "PAYABLE")) {
    addTo(expenseByCategory, entry.category?.name ?? "Sem categoria", entry.paidAmount / CENTS_PER_REAL);
  }
  const monthTargetCents = monthGoals.reduce((total, goal) => total + (goal.revenueTargetCents ?? 0), 0);
  const monthRevenueCents = monthRevenueEntries.reduce((total, entry) => total + entry.paidAmount, 0);
  return {
    cashResult: (revenue - expense) / CENTS_PER_REAL,
    defaultRate: toPercent(
      overdueReceivables.reduce((total, entry) => total + entry.amount, 0),
      openReceivables.reduce((total, entry) => total + entry.amount, 0),
    ),
    expenseByCategory: toRanking(expenseByCategory),
    monthGoalProgress: toPercent(monthRevenueCents, monthTargetCents),
    taxesAssessed: taxAssessments.reduce((total, assessment) => total + assessment.amountCents, 0) / CENTS_PER_REAL,
    overdueObligations,
  };
}

async function loadStarsExtras({ organizationIds, createdAtFilter }: KpiExtrasFilters) {
  const consumptionSince = new Date(Date.now() - STARS_CONSUMPTION_WINDOW_DAYS * DAY_MS);
  const [usageEvents, recentCharges, organizations] = await Promise.all([
    prisma.usageEvent.findMany({
      where: {
        organizationId: { in: organizationIds },
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      },
      select: { costBrl: true, revenueBrl: true },
    }),
    prisma.starTransaction.findMany({
      where: { organizationId: { in: organizationIds }, type: "APP_CHARGE", createdAt: { gte: consumptionSince } },
      select: { amount: true },
    }),
    prisma.organization.findMany({
      where: { id: { in: organizationIds } },
      select: { starsBalance: true, starsBonusBalance: true },
    }),
  ]);
  const aiCostBrl = usageEvents.reduce((total, event) => total + Number(event.costBrl ?? 0), 0);
  const aiRevenueBrl = usageEvents.reduce((total, event) => total + Number(event.revenueBrl ?? 0), 0);
  const dailyConsumption =
    recentCharges.reduce((total, charge) => total + Math.abs(charge.amount), 0) / STARS_CONSUMPTION_WINDOW_DAYS;
  const currentBalance = organizations.reduce(
    (total, organization) => total + organization.starsBalance + organization.starsBonusBalance,
    0,
  );
  return {
    aiCostBrl,
    aiMargin: toPercent(aiRevenueBrl - aiCostBrl, aiRevenueBrl),
    // Em horas, porque o catálogo mostra durações a partir de horas.
    hoursUntilEmpty: dailyConsumption > 0 ? (currentBalance / dailyConsumption) * 24 : 0,
  };
}

async function loadNasaRouteExtras({ organizationIds, createdAtFilter }: KpiExtrasFilters) {
  const paidEnrollments = await prisma.nasaRouteEnrollment.findMany({
    where: {
      course: { creatorOrgId: { in: organizationIds } },
      paidBrlCents: { gt: 0 },
      ...(createdAtFilter ? { enrolledAt: createdAtFilter } : {}),
    },
    select: { paidBrlCents: true },
  });
  return {
    revenueBrl: paidEnrollments.reduce((total, enrollment) => total + (enrollment.paidBrlCents ?? 0), 0) / CENTS_PER_REAL,
  };
}

async function loadCampanhasExtras({ organizationIds, createdAtFilter, trackingId }: KpiExtrasFilters) {
  const sentRecipients = await prisma.broadcastRecipient.findMany({
    where: {
      broadcast: {
        organizationId: { in: organizationIds },
        ...(trackingId ? { trackingId } : {}),
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      },
      sentAt: { not: null },
    },
    select: { sentAt: true, lead: { select: { lastInboundAt: true, currentAction: true, closedAt: true } } },
  });
  const respondedRecipients = sentRecipients.filter(
    (recipient) => recipient.sentAt && recipient.lead?.lastInboundAt && recipient.lead.lastInboundAt > recipient.sentAt,
  ).length;
  const wonAfterCampaign = sentRecipients.filter(
    (recipient) =>
      recipient.sentAt &&
      recipient.lead?.currentAction === "WON" &&
      recipient.lead.closedAt &&
      recipient.lead.closedAt > recipient.sentAt,
  ).length;
  return { responseRate: toPercent(respondedRecipients, sentRecipients.length), wonAfterCampaign };
}

async function loadTrafegoExtras({ organizationIds, createdAtFilter }: KpiExtrasFilters) {
  const orders = await prisma.trafegoOrder.findMany({
    where: {
      organizationId: { in: organizationIds },
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    },
    select: { status: true, createdAt: true, startedAt: true },
  });
  const ordersByStatus = new Map<string, number>();
  for (const order of orders) addTo(ordersByStatus, order.status);
  return {
    avgTimeToLive: averageHours(
      orders.flatMap((order) => (order.startedAt ? [order.startedAt.getTime() - order.createdAt.getTime()] : [])),
    ),
    ordersByStatus: toRanking(ordersByStatus),
  };
}

interface CatalogOrderItem {
  name?: string;
  title?: string;
  quantity?: number;
}

async function loadNerpExtras({ organizationIds, createdAtFilter, trackingId, tagIds }: KpiExtrasFilters) {
  const paidOrders = await prisma.catalogOrder.findMany({
    where: {
      organizationId: { in: organizationIds },
      ...(tagIds && tagIds.length > 0 ? { lead: { leadTags: { some: { tagId: { in: tagIds } } } } } : {}),
      status: { in: CATALOG_PAID_STATUSES as never },
      ...(trackingId ? { trackingId } : {}),
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    },
    select: { leadId: true, items: true, createdAt: true, paidAt: true },
  });
  const unitsByProduct = new Map<string, number>();
  for (const order of paidOrders) {
    const orderItems = Array.isArray(order.items) ? (order.items as CatalogOrderItem[]) : [];
    for (const orderItem of orderItems) {
      addTo(unitsByProduct, orderItem.name ?? orderItem.title ?? "Produto", Number(orderItem.quantity ?? 1));
    }
  }
  const paidOrdersByLead = new Map<string, number>();
  for (const order of paidOrders) addTo(paidOrdersByLead, order.leadId);
  const repeatBuyers = [...paidOrdersByLead.values()].filter((orderCount) => orderCount >= 2).length;
  return {
    avgTimeToPay: averageHours(
      paidOrders.flatMap((order) => (order.paidAt ? [order.paidAt.getTime() - order.createdAt.getTime()] : [])),
    ),
    topProducts: toRanking(unitsByProduct),
    repurchaseRate: toPercent(repeatBuyers, paidOrdersByLead.size),
  };
}

async function loadStarFriendsExtras({ organizationIds, createdAtFilter }: KpiExtrasFilters) {
  const [ledgerEntries, pendingRedemptions, programs, memberBalances] = await Promise.all([
    prisma.loyaltyLedgerEntry.findMany({
      where: {
        organizationId: { in: organizationIds },
        type: { in: ["EARN", "REDEEM"] },
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      },
      select: { type: true, stars: true },
    }),
    prisma.loyaltyRedemption.count({ where: { organizationId: { in: organizationIds }, status: "PENDING" } }),
    prisma.loyaltyProgram.findMany({
      where: { organizationId: { in: organizationIds } },
      select: { moonMinStars: true, galaxyMinStars: true },
    }),
    // Nível vem das estrelas acumuladas (ganhos + ajustes de crédito), não do saldo (spec 0041, RF-2).
    prisma.loyaltyLedgerEntry.groupBy({
      by: ["memberId"],
      where: { organizationId: { in: organizationIds }, type: { in: ["EARN", "ADJUST_CREDIT"] } },
      _sum: { stars: true },
    }),
  ]);
  const earned = ledgerEntries.filter((entry) => entry.type === "EARN").reduce((total, entry) => total + entry.stars, 0);
  const redeemed = ledgerEntries
    .filter((entry) => entry.type === "REDEEM")
    .reduce((total, entry) => total + Math.abs(entry.stars), 0);
  const program = programs[0];
  const membersByLevel = new Map<string, number>([["Terra", 0], ["Lua", 0], ["Galaxy", 0]]);
  for (const memberBalance of memberBalances) {
    const accumulatedStars = memberBalance._sum.stars ?? 0;
    const levelName =
      program && accumulatedStars >= program.galaxyMinStars
        ? "Galaxy"
        : program && accumulatedStars >= program.moonMinStars
          ? "Lua"
          : "Terra";
    addTo(membersByLevel, levelName);
  }
  return {
    redemptionRate: toPercent(redeemed, earned),
    pendingRedemptions,
    membersByLevel: [...membersByLevel.entries()].map(([name, value]) => ({ name, value })),
  };
}

function settle<TValue>(loadPromise: Promise<TValue>, label: string): Promise<TValue | undefined> {
  // Um indicador extra que falha não pode derrubar o Insights inteiro.
  return loadPromise.catch((loadError: unknown) => {
    console.warn(`[insights] indicadores extras de ${label} falharam:`, loadError);
    return undefined;
  });
}

export async function loadKpiExtras(filters: KpiExtrasFilters) {
  const [tracking, chat, forge, spacetime, nasaPlanner, workspace, forms, payment, stars, nasaRoute, campanhas, trafego, nerp, starFriends] =
    await Promise.all([
      settle(loadTrackingExtras(filters), "tracking"),
      settle(loadChatExtras(filters), "chat"),
      settle(loadForgeExtras(filters), "forge"),
      settle(loadSpacetimeExtras(filters), "spacetime"),
      settle(loadPlannerExtras(filters), "planner"),
      settle(loadWorkspaceExtras(filters), "workspace"),
      settle(loadFormsExtras(filters), "forms"),
      settle(loadPaymentExtras(filters), "payment"),
      settle(loadStarsExtras(filters), "stars"),
      settle(loadNasaRouteExtras(filters), "nasa-route"),
      settle(loadCampanhasExtras(filters), "campanhas"),
      settle(loadTrafegoExtras(filters), "trafego"),
      settle(loadNerpExtras(filters), "nerp"),
      settle(loadStarFriendsExtras(filters), "star-friends"),
    ]);
  return { tracking, chat, forge, spacetime, nasaPlanner, workspace, forms, payment, stars, nasaRoute, campanhas, trafego, nerp, starFriends };
}
