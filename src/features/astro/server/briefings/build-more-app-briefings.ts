import prisma from "@/lib/prisma";
import { findDocumentType } from "@/features/accounting/lib/compliance/document-catalog";
import {
  formatBrl,
  formatBrtDayMonth,
  pluralize,
  userTrackingsFilter,
  type BriefingAudience,
} from "./build-app-briefings";

/** Resumos dos demais Apps no painel do Astro (spec 0056): mesmas regras, só leitura no banco. */

const CENTS_PER_REAL = 100;
const BYTES_PER_MEGABYTE = 1024 * 1024;
const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const PAGE_EVENT_PATH_PREFIX = "_evt:";

const INTEGRATION_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  LINKEDIN: "LinkedIn",
  GMAIL: "Gmail",
  GOOGLE_MAPS: "Google Maps",
  GOOGLE_CALENDAR: "Google Agenda",
  META: "Meta",
  OPENAI: "OpenAI",
  ANTHROPIC: "Anthropic",
  GEMINI: "Gemini",
  KOMMO: "Kommo",
  RD_STATION: "RD Station",
  PIPEDRIVE: "Pipedrive",
  HUGGING_FACE: "Hugging Face",
  POLLINATIONS: "Pollinations",
  NERP: "NERP",
  COMMENTS_APP: "Comentários",
  SEI: "SEI",
};

export async function buildCampanhasBriefing({ organizationId, firstName, period }: BriefingAudience) {
  const weekBroadcasts = await prisma.broadcast.aggregate({
    where: { organizationId, startedAt: { gte: period.weekStart } },
    _count: { _all: true },
    _sum: { sentCount: true, deliveredCount: true, readCount: true },
  });
  const broadcastCount = weekBroadcasts._count._all;
  if (broadcastCount === 0) return `${firstName}, nenhuma campanha foi disparada esta semana.`;

  const sentCount = weekBroadcasts._sum.sentCount ?? 0;
  const deliveredCount = weekBroadcasts._sum.deliveredCount ?? 0;
  const readCount = weekBroadcasts._sum.readCount ?? 0;
  return `${firstName}, esta semana você disparou ${pluralize(broadcastCount, "campanha", "campanhas")}: ${sentCount} mensagens enviadas, ${deliveredCount} entregues e ${readCount} lidas.`;
}

export async function buildContactsBriefing(audience: BriefingAudience) {
  const { firstName, period } = audience;
  const monthContacts = await prisma.lead.count({
    where: { tracking: userTrackingsFilter(audience), currentAction: { not: "DELETED" }, createdAt: { gte: period.monthStart } },
  });
  return monthContacts === 0
    ? `${firstName}, nenhum contato novo entrou este mês.`
    : `${firstName}, este mês ${monthContacts === 1 ? "entrou 1 contato novo" : `entraram ${monthContacts} contatos novos`} nos seus funis.`;
}

export async function buildPagesBriefing({ organizationId, firstName, period }: BriefingAudience) {
  const weekVisitsByPage = await prisma.nasaPageVisit.groupBy({
    by: ["pageId"],
    where: {
      page: { organizationId },
      createdAt: { gte: period.weekStart },
      NOT: { path: { startsWith: PAGE_EVENT_PATH_PREFIX } },
    },
    _count: { _all: true },
    orderBy: { _count: { pageId: "desc" } },
  });
  const visitCount = weekVisitsByPage.reduce((total, pageVisits) => total + pageVisits._count._all, 0);
  if (visitCount === 0) return `${firstName}, suas páginas ainda não tiveram visitas esta semana.`;

  const topPage = await prisma.nasaPage.findUnique({
    where: { id: weekVisitsByPage[0].pageId },
    select: { title: true },
  });
  const visitText = pluralize(visitCount, "visita", "visitas");
  return topPage
    ? `${firstName}, suas páginas tiveram ${visitText} esta semana e a mais acessada foi ${topPage.title}.`
    : `${firstName}, suas páginas tiveram ${visitText} esta semana.`;
}

export async function buildLinnkerBriefing({ organizationId, firstName, period }: BriefingAudience) {
  const [weekAccessCount, topLink] = await Promise.all([
    prisma.linnkerScan.count({ where: { page: { organizationId }, createdAt: { gte: period.weekStart } } }),
    prisma.linnkerLink.findFirst({
      where: { page: { organizationId }, clicks: { gt: 0 } },
      orderBy: { clicks: "desc" },
      select: { title: true, clicks: true },
    }),
  ]);
  const accessText =
    weekAccessCount === 0
      ? "seu Linnker ainda não teve acessos esta semana"
      : `seu Linnker teve ${pluralize(weekAccessCount, "acesso", "acessos")} esta semana`;
  return topLink
    ? `${firstName}, ${accessText}. O link campeão é ${topLink.title}, com ${pluralize(topLink.clicks, "clique", "cliques")} no total.`
    : `${firstName}, ${accessText}.`;
}

export async function buildNBoxBriefing({ organizationId, firstName, period }: BriefingAudience) {
  const [weekItems, totalItems] = await Promise.all([
    prisma.nBoxItem.aggregate({
      where: { organizationId, createdAt: { gte: period.weekStart } },
      _count: { _all: true },
      _sum: { size: true },
    }),
    prisma.nBoxItem.count({ where: { organizationId } }),
  ]);
  const weekCount = weekItems._count._all;
  if (weekCount === 0) {
    return totalItems === 0
      ? `${firstName}, seu N-Box ainda está vazio.`
      : `${firstName}, nada novo no N-Box esta semana. São ${pluralize(totalItems, "item guardado", "itens guardados")}.`;
  }
  const weekMegabytes = (weekItems._sum.size ?? 0) / BYTES_PER_MEGABYTE;
  const sizeText = weekMegabytes >= 0.1 ? ` (${weekMegabytes.toFixed(1).replace(".", ",")} MB)` : "";
  return `${firstName}, esta semana ${weekCount === 1 ? "entrou 1 arquivo" : `entraram ${weekCount} arquivos`} no N-Box${sizeText}. São ${pluralize(totalItems, "item", "itens")} no total.`;
}

export async function buildInsightsBriefing({ organizationId, firstName, period }: BriefingAudience) {
  const wonInOrganization = { action: "WON" as const, lead: { tracking: { organizationId } } };
  const [currentMonthWins, previousMonthWins] = await Promise.all([
    prisma.leadHistory.count({ where: { ...wonInOrganization, createdAt: { gte: period.monthStart } } }),
    prisma.leadHistory.count({
      where: { ...wonInOrganization, createdAt: { gte: period.previousMonthStart, lt: period.monthStart } },
    }),
  ]);
  if (currentMonthWins === 0 && previousMonthWins === 0) {
    return `${firstName}, ainda não há vendas ganhas este mês nem no mês passado.`;
  }
  const currentText = `você ganhou ${pluralize(currentMonthWins, "venda", "vendas")} este mês`;
  if (previousMonthWins === 0) return `${firstName}, ${currentText}. No mês passado não houve nenhuma.`;
  const changePercent = Math.round(((currentMonthWins - previousMonthWins) / previousMonthWins) * 100);
  const changeText = changePercent === 0 ? "o mesmo ritmo" : changePercent > 0 ? `${changePercent}% a mais` : `${Math.abs(changePercent)}% a menos`;
  return `${firstName}, ${currentText}, contra ${previousMonthWins} no mês passado (${changeText}).`;
}

export async function buildPlannerBriefing({ organizationId, firstName, period }: BriefingAudience) {
  const [weekScheduledCount, overdueCount] = await Promise.all([
    prisma.nasaPlannerPost.count({
      where: { organizationId, status: "SCHEDULED", scheduledAt: { gte: period.weekStart, lt: period.weekEnd } },
    }),
    prisma.nasaPlannerPost.count({
      where: {
        organizationId,
        status: { in: ["SCHEDULED", "APPROVED", "PENDING_APPROVAL"] },
        scheduledAt: { lt: period.now },
        publishedAt: null,
      },
    }),
  ]);
  if (weekScheduledCount === 0 && overdueCount === 0) {
    return `${firstName}, não há posts agendados para esta semana nem atrasados.`;
  }
  const scheduledText = `${pluralize(weekScheduledCount, "post agendado", "posts agendados")} para esta semana`;
  return overdueCount > 0
    ? `${firstName}, você tem ${scheduledText} e ${pluralize(overdueCount, "atrasado", "atrasados")}.`
    : `${firstName}, você tem ${scheduledText} e nenhum atrasado.`;
}

export async function buildRouteBriefing({ organizationId, firstName, period }: BriefingAudience) {
  const monthEnrollments = await prisma.nasaRouteEnrollment.aggregate({
    where: { course: { creatorOrgId: organizationId }, status: "active", enrolledAt: { gte: period.monthStart } },
    _count: { _all: true },
    _sum: { paidBrlCents: true },
  });
  const studentCount = monthEnrollments._count._all;
  if (studentCount === 0) return `${firstName}, seus cursos ainda não ganharam alunos novos este mês.`;
  const revenueCents = monthEnrollments._sum.paidBrlCents ?? 0;
  const studentText = `seus cursos ganharam ${pluralize(studentCount, "aluno novo", "alunos novos")} este mês`;
  return revenueCents > 0
    ? `${firstName}, ${studentText} e faturaram ${formatBrl(revenueCents / CENTS_PER_REAL)}.`
    : `${firstName}, ${studentText}.`;
}

export async function buildTrafegoBriefing({ organizationId, firstName, period }: BriefingAudience) {
  const [weekKpis, runningOrders] = await Promise.all([
    prisma.metaAdsKpiSnapshot.aggregate({
      where: { organizationId, level: "ACCOUNT", date: { gte: period.weekStart } },
      _sum: { spend: true, leads: true },
    }),
    prisma.trafegoOrder.count({ where: { organizationId, status: "RUNNING" } }),
  ]);
  const weekSpend = Number(weekKpis._sum.spend ?? 0);
  const weekLeads = weekKpis._sum.leads ?? 0;
  const runningText =
    runningOrders > 0 ? ` ${runningOrders === 1 ? "1 campanha trafeGO está rodando" : `${runningOrders} campanhas trafeGO estão rodando`}.` : "";
  if (weekSpend === 0) return `${firstName}, nenhum gasto com anúncios esta semana.${runningText}`;
  return `${firstName}, esta semana você investiu ${formatBrl(weekSpend)} em anúncios e eles trouxeram ${pluralize(weekLeads, "lead", "leads")}.${runningText}`;
}

export async function buildIntegrationsBriefing({ organizationId, firstName }: BriefingAudience) {
  const activeIntegrations = await prisma.platformIntegration.findMany({
    where: { organizationId, isActive: true },
    select: { platform: true },
    orderBy: { platform: "asc" },
  });
  if (activeIntegrations.length === 0) return `${firstName}, você ainda não conectou nenhum satélite.`;
  const platformNames = activeIntegrations.map((integration) => INTEGRATION_LABELS[integration.platform] ?? integration.platform);
  return `${firstName}, você tem ${pluralize(platformNames.length, "satélite conectado", "satélites conectados")}: ${platformNames.join(", ")}.`;
}

export async function buildStarFriendsBriefing({ organizationId, firstName }: BriefingAudience) {
  const [memberCount, pendingRedemptions] = await Promise.all([
    prisma.loyaltyMember.count({ where: { organizationId } }),
    prisma.loyaltyRedemption.count({ where: { organizationId, status: "PENDING" } }),
  ]);
  if (memberCount === 0) return `${firstName}, seu programa STAR FRIENDS ainda não tem clientes.`;
  const memberText = `você tem ${pluralize(memberCount, "cliente", "clientes")} no STAR FRIENDS`;
  return pendingRedemptions > 0
    ? `${firstName}, ${memberText} e ${pluralize(pendingRedemptions, "resgate esperando", "resgates esperando")} sua aprovação.`
    : `${firstName}, ${memberText} e nenhum resgate esperando.`;
}

/** Saldo lido direto da organização: `checkBalance()` grava o bônus de boas-vindas e não pode rodar aqui. */
export async function buildSpaceStationBriefing({ organizationId, userId, firstName, period }: BriefingAudience) {
  const [organization, connections] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { starsBalance: true, starsBonusBalance: true },
    }),
    prisma.userConnection.findMany({ where: { userId }, select: { connectedId: true } }),
  ]);
  const onlineFriends = connections.length
    ? await prisma.userPresence.count({
        where: {
          organizationId,
          userId: { in: connections.map((connection) => connection.connectedId) },
          lastSeenAt: { gte: new Date(period.now.getTime() - ONLINE_WINDOW_MS) },
        },
      })
    : 0;
  const starsBalance = (organization?.starsBalance ?? 0) + (organization?.starsBonusBalance ?? 0);
  const friendsText =
    onlineFriends > 0 ? `${pluralize(onlineFriends, "amigo está", "amigos estão")} online agora` : "nenhum amigo online agora";
  return `${firstName}, sua empresa tem ${pluralize(starsBalance, "Star", "Stars")} disponíveis e ${friendsText}.`;
}

export async function buildSpaceHelpBriefing({ userId, firstName }: BriefingAudience) {
  const [completedTracks, publishedTracks] = await Promise.all([
    prisma.spaceHelpProgress.count({ where: { userId, completedAt: { not: null } } }),
    prisma.spaceHelpTrack.count({ where: { isPublished: true } }),
  ]);
  if (publishedTracks === 0) return `${firstName}, as trilhas do Space Help estão chegando em breve.`;
  if (completedTracks === 0) return `${firstName}, você ainda não concluiu nenhuma das ${publishedTracks} trilhas. Que tal começar hoje?`;
  return `${firstName}, você concluiu ${completedTracks} de ${pluralize(publishedTracks, "trilha", "trilhas")} do Space Help.`;
}

export async function buildFinanceBriefing({ organizationId, firstName, period }: BriefingAudience) {
  const openPayables = { organizationId, type: "PAYABLE" as const };
  const [weekDue, overdue] = await Promise.all([
    prisma.paymentEntry.aggregate({
      where: { ...openPayables, status: { in: ["PENDING", "PARTIAL"] }, dueDate: { gte: period.dayStart, lt: period.weekEnd } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.paymentEntry.aggregate({
      where: { ...openPayables, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] }, dueDate: { lt: period.dayStart } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);
  const weekDueCount = weekDue._count._all;
  const overdueCount = overdue._count._all;
  if (weekDueCount === 0 && overdueCount === 0) return `${firstName}, nenhuma conta a pagar vence esta semana e nada está atrasado.`;

  const weekText =
    weekDueCount > 0
      ? `esta semana ${weekDueCount === 1 ? "vence 1 conta" : `vencem ${weekDueCount} contas`} a pagar (${formatBrl((weekDue._sum.amount ?? 0) / CENTS_PER_REAL)})`
      : "nenhuma conta a pagar vence esta semana";
  const overdueText =
    overdueCount > 0
      ? ` e ${pluralize(overdueCount, "está atrasada", "estão atrasadas")} (${formatBrl((overdue._sum.amount ?? 0) / CENTS_PER_REAL)})`
      : ", e nada está atrasado";
  return `${firstName}, ${weekText}${overdueText}.`;
}

export async function buildAccountingBriefing({ organizationId, firstName }: BriefingAudience) {
  const nextObligation = await prisma.fiscalObligation.findFirst({
    where: { organizationId, status: { in: ["PENDING", "OVERDUE"] } },
    orderBy: { dueDate: "asc" },
    select: { kind: true, period: true, dueDate: true, status: true, assessment: { select: { amountCents: true } } },
  });
  if (!nextObligation) return `${firstName}, nenhuma obrigação fiscal pendente por aqui.`;

  const obligationLabel = findDocumentType(nextObligation.kind)?.label ?? nextObligation.kind;
  const amountCents = nextObligation.assessment?.amountCents;
  const amountText = amountCents ? `, no valor de ${formatBrl(amountCents / CENTS_PER_REAL)}` : "";
  const dueText = nextObligation.status === "OVERDUE" ? "venceu em" : "vence em";
  return `${firstName}, a próxima obrigação é ${obligationLabel} (${nextObligation.period}), que ${dueText} ${formatBrtDayMonth(nextObligation.dueDate)}${amountText}.`;
}
