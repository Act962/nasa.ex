import "server-only";
import prisma from "@/lib/prisma";
import { rankBySimilarity } from "@/features/astro/actions/fuzzy-match";
import {
  money,
  normalizeQuestion,
  periodFrom,
  plural,
  startOfToday,
  type AstroQuery,
} from "./types";

// Consultas com filtro, período e comparação (bateria F2). Todas em código:
// cada uma era um orquestrador de ~23 mil tokens montando a mesma query.

const DAY_MS = 24 * 60 * 60_000;
const MAX_ROWS = 30;
const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

function formatBrazilDate(value: Date): string {
  return value.toLocaleDateString("pt-BR", { timeZone: BRAZIL_TIME_ZONE });
}

function formatBrazilTime(value: Date): string {
  return value.toLocaleTimeString("pt-BR", { timeZone: BRAZIL_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
}

/** Palavra da frase que casa com o nome (ou o começo dele): "quentes" → "Quente". */
function mentions(text: string, name: string): boolean {
  const normalizedName = normalizeQuestion(name);
  if (text.includes(normalizedName)) return true;
  const stem = normalizedName.replace(/s$/, "");
  return stem.length >= 4 && new RegExp(`\\b${stem}s?\\b`).test(text);
}

// ── Leads com filtro de tag, funil e período ───────────────────────────────

const filteredLeads: AstroQuery = {
  key: "tracking.leads_filtered",
  app: "tracking",
  appKey: "tracking",
  matches: (text) =>
    /\bleads?\b/.test(text) &&
    /\b(do funil|no funil|com a tag|criados?|entraram|quentes?|frios?|mornos?)\b/.test(text) &&
    !/\b(quantos|quantas)\b.*\b(o|a)\s+\w+\s+tem\b/.test(text),
  run: async ({ ctx, text }) => {
    const [trackings, tags] = await Promise.all([
      prisma.tracking.findMany({ where: { organizationId: ctx.organizationId }, select: { id: true, name: true } }),
      prisma.tag.findMany({ where: { organizationId: ctx.organizationId }, select: { id: true, name: true } }),
    ]);
    const tracking = trackings.find((item) => mentions(text, item.name));
    const tag = tags.find((item) => mentions(text, item.name));
    const period = periodFrom(text);
    // Sem nenhum filtro reconhecido, a lista genérica responde.
    if (!tracking && !tag && !period) return null;

    const leads = await prisma.lead.findMany({
      where: {
        tracking: { organizationId: ctx.organizationId },
        ...(tracking ? { trackingId: tracking.id } : {}),
        ...(tag ? { leadTags: { some: { tagId: tag.id } } } : {}),
        ...(period ? { createdAt: { gte: period.since, lt: period.until } } : {}),
      },
      select: { id: true, name: true, status: { select: { name: true } }, tracking: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
    });
    const filters = [
      tag ? `com a tag ${tag.name}` : null,
      tracking ? `no funil ${tracking.name}` : null,
      period ? `criados ${period.label}` : null,
    ].filter(Boolean);
    if (leads.length === 0) return { text: `Nenhum lead ${filters.join(", ")}.` };
    return {
      text: `${leads.length} ${plural(leads.length, "lead", "leads")} ${filters.join(", ")}:`,
      table: {
        kind: "astro_table",
        entityType: "lead",
        title: "Leads",
        columns: [
          { key: "name", label: "Lead" },
          { key: "etapa", label: "Etapa" },
          { key: "funil", label: "Funil" },
        ],
        rows: leads.map((lead) => ({ id: lead.id, name: lead.name, etapa: lead.status.name, funil: lead.tracking.name })),
        totalCount: leads.length,
      },
    };
  },
};

// ── Leads de uma pessoa da equipe ──────────────────────────────────────────

const leadsByPerson: AstroQuery = {
  key: "tracking.leads_by_person",
  app: "tracking",
  appKey: "tracking",
  matches: (text) => /\bquantos leads\s+(o|a)\s+[a-z]+(\s+[a-z]+)?\s+tem\b/.test(text),
  run: async ({ ctx, text }) => {
    const spokenName = text.match(/\bquantos leads\s+(?:o|a)\s+([a-z]+(?:\s+[a-z]+)?)\s+tem\b/)?.[1];
    if (!spokenName) return null;
    const members = await prisma.member.findMany({
      where: { organizationId: ctx.organizationId },
      select: { userId: true, user: { select: { name: true } } },
    });
    const [member] = rankBySimilarity(
      spokenName,
      members.map((item) => ({ id: item.userId, name: item.user.name })),
      1,
    );
    if (member) {
      const count = await prisma.lead.count({
        where: { responsibleId: member.id, tracking: { organizationId: ctx.organizationId } },
      });
      return { text: `${member.name} é responsável por ${count} ${plural(count, "lead", "leads")}.` };
    }
    // Não é da equipe: talvez seja um lead — "Kaue" com erro vira "Kauê".
    const leads = await prisma.lead.findMany({
      where: { tracking: { organizationId: ctx.organizationId } },
      select: { id: true, name: true },
      take: 500,
    });
    const similarLeads = rankBySimilarity(spokenName, leads, 5);
    if (similarLeads.length > 0) {
      return {
        text:
          `Ninguém da equipe se chama "${spokenName}". ` +
          `${similarLeads.map((lead) => lead.name).join(" e ")} ${plural(similarLeads.length, "é lead", "são leads")}, não responsáveis.`,
      };
    }
    return { text: `Não achei "${spokenName}" na equipe nem entre os leads.` };
  },
};

// ── Comparação de períodos ─────────────────────────────────────────────────

const leadsComparison: AstroQuery = {
  key: "insights.leads_compare",
  app: "insights",
  appKey: "insights",
  matches: (text) => /\b(compara|comparar|compare|comparacao|versus|vs)\b/.test(text) && /\bleads?\b/.test(text),
  run: async ({ ctx }) => {
    const today = startOfToday();
    const thisWeekStart = new Date(today.getTime() - 6 * DAY_MS);
    const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * DAY_MS);
    const [thisWeek, lastWeek] = await Promise.all([
      prisma.lead.count({
        where: { tracking: { organizationId: ctx.organizationId }, createdAt: { gte: thisWeekStart } },
      }),
      prisma.lead.count({
        where: {
          tracking: { organizationId: ctx.organizationId },
          createdAt: { gte: lastWeekStart, lt: thisWeekStart },
        },
      }),
    ]);
    const variation =
      lastWeek === 0
        ? thisWeek > 0
          ? "sem base para variação (semana passada teve 0)"
          : "sem variação"
        : `${thisWeek >= lastWeek ? "+" : ""}${Math.round(((thisWeek - lastWeek) / lastWeek) * 100)}%`;
    return {
      text: `Últimos 7 dias: ${thisWeek} ${plural(thisWeek, "lead", "leads")}. Semana anterior: ${lastWeek}. Variação: ${variation}.`,
    };
  },
};

// ── Chat: quem espera resposta ─────────────────────────────────────────────

const waitingConversations: AstroQuery = {
  key: "chat.waiting",
  app: "chat",
  appKey: "chat",
  matches: (text) => /\b(esperando|aguardando|sem resposta)\b/.test(text) && /\b(quem|quais|minutos?|horas?)\b/.test(text),
  run: async ({ ctx, text }) => {
    const minutes = Number(text.match(/\b(\d{1,3})\s*min/)?.[1] ?? 5);
    const cutoff = new Date(Date.now() - minutes * 60_000);
    const conversations = await prisma.conversation.findMany({
      where: { tracking: { organizationId: ctx.organizationId } },
      select: {
        id: true,
        trackingId: true,
        lead: { select: { name: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { fromMe: true, createdAt: true } },
      },
      take: 200,
    });
    const waiting = conversations
      .filter((conversation) => {
        const last = conversation.messages[0];
        return last && !last.fromMe && last.createdAt < cutoff;
      })
      .map((conversation) => ({
        id: conversation.id,
        trackingId: conversation.trackingId,
        name: conversation.lead.name,
        since: conversation.messages[0].createdAt,
      }))
      .sort((first, second) => first.since.getTime() - second.since.getTime());
    if (waiting.length === 0) return { text: `Ninguém esperando resposta há mais de ${minutes} minutos.` };
    return {
      text: `${waiting.length} ${plural(waiting.length, "conversa espera", "conversas esperam")} resposta há mais de ${minutes} minutos:`,
      table: {
        kind: "astro_table",
        entityType: "conversation",
        title: "Esperando resposta",
        columns: [
          { key: "name", label: "Lead" },
          { key: "desde", label: "Desde" },
        ],
        rows: waiting.map((item) => ({
          id: item.id,
          trackingId: item.trackingId,
          name: item.name,
          desde: `${formatBrazilDate(item.since)} ${formatBrazilTime(item.since)}`,
        })),
        totalCount: waiting.length,
      },
    };
  },
};

// ── Agenda: horários livres ────────────────────────────────────────────────

const WORK_START_HOUR = 8;
const WORK_END_HOUR = 18;
const MORNING_END_HOUR = 12;
const AFTERNOON_START_HOUR = 13;

const freeSlots: AstroQuery = {
  key: "agenda.free_slots",
  app: "agenda",
  appKey: "spacetime",
  matches: (text) => /\b(livre|livres|vago|vagos|disponivel|disponiveis|horario livre)\b/.test(text),
  run: async ({ ctx, text }) => {
    const period = periodFrom(text) ?? periodFrom("amanha")!;
    const isMorning = /\bmanha\b/.test(text.replace(/\bamanha\b/g, ""));
    const isAfternoon = /\btarde\b/.test(text);
    const firstHour = isAfternoon ? AFTERNOON_START_HOUR : WORK_START_HOUR;
    const lastHour = isMorning ? MORNING_END_HOUR : WORK_END_HOUR;
    const appointments = await prisma.appointment.findMany({
      where: {
        agenda: { organizationId: ctx.organizationId },
        userId: ctx.userId,
        status: { not: "CANCELLED" },
        startsAt: { lt: period.futureUntil },
        endsAt: { gt: period.since },
      },
      select: { startsAt: true, endsAt: true },
    });
    const free: string[] = [];
    for (let hour = firstHour; hour < lastHour; hour++) {
      const slotStart = new Date(period.since.getTime() + hour * 60 * 60_000);
      const slotEnd = new Date(slotStart.getTime() + 60 * 60_000);
      if (slotStart.getTime() < Date.now()) continue;
      const isBusy = appointments.some((item) => item.startsAt < slotEnd && item.endsAt > slotStart);
      if (!isBusy) free.push(formatBrazilTime(slotStart));
    }
    const window = isMorning ? " de manhã" : isAfternoon ? " à tarde" : "";
    if (free.length === 0) return { text: `Nada livre ${period.label}${window}.` };
    return { text: `Livre ${period.label}${window}: ${free.join(", ")}.` };
  },
};

// ── Forge: valor em aberto ─────────────────────────────────────────────────

const openProposalsValue: AstroQuery = {
  key: "forge.open_value",
  app: "forge",
  appKey: "forge",
  matches: (text) =>
    /\bpropostas?\b/.test(text) &&
    /\b(quanto|valor|total|soma)\b/.test(text) &&
    /\b(enviadas?|abertas?|em aberto|nao fechadas?|pendentes?)\b/.test(text),
  run: async ({ ctx }) => {
    const proposals = await prisma.forgeProposal.findMany({
      where: { organizationId: ctx.organizationId, status: { in: ["ENVIADA", "VISUALIZADA"] } },
      select: { products: { select: { unitValue: true, quantity: true } } },
    });
    const total = proposals.reduce(
      (sum, proposal) =>
        sum + proposal.products.reduce((itemSum, item) => itemSum + Number(item.unitValue) * Number(item.quantity), 0),
      0,
    );
    return {
      text: `${proposals.length} ${plural(proposals.length, "proposta enviada", "propostas enviadas")} sem fechamento, somando ${money(Math.round(total * 100))}.`,
    };
  },
};

// ── Financeiro: vencimentos e gasto por categoria ──────────────────────────

const dueEntries: AstroQuery = {
  key: "payment.due_period",
  app: "payment",
  appKey: "financeiro",
  matches: (text) => /\b(vence|vencem|vencendo|vencimento|vencimentos)\b/.test(text),
  run: async ({ ctx, text }) => {
    const period = periodFrom(text);
    const since = startOfToday();
    const until = period ? period.futureUntil : new Date(since.getTime() + 7 * DAY_MS);
    const [dueSoon, overdueCount] = await Promise.all([
      prisma.paymentEntry.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: { in: ["PENDING", "PARTIAL"] },
          dueDate: { gte: since, lt: until },
        },
        select: { id: true, description: true, amount: true, dueDate: true, type: true },
        orderBy: { dueDate: "asc" },
        take: MAX_ROWS,
      }),
      prisma.paymentEntry.count({
        where: { organizationId: ctx.organizationId, OR: [{ status: "OVERDUE" }, { status: "PENDING", dueDate: { lt: since } }] },
      }),
    ]);
    const overdueLine = overdueCount > 0 ? ` Além disso, ${overdueCount} ${plural(overdueCount, "lançamento vencido", "lançamentos vencidos")}.` : "";
    if (dueSoon.length === 0) return { text: `Nada vencendo ${period?.label ?? "nos próximos 7 dias"}.${overdueLine}` };
    return {
      text: `${dueSoon.length} ${plural(dueSoon.length, "lançamento vence", "lançamentos vencem")} ${period?.label ?? "nos próximos 7 dias"}.${overdueLine}`,
      table: {
        kind: "astro_table",
        entityType: "payment",
        title: "Vencimentos",
        columns: [
          { key: "descricao", label: "Lançamento" },
          { key: "valor", label: "Valor" },
          { key: "vencimento", label: "Vencimento" },
        ],
        rows: dueSoon.map((entry) => ({
          id: entry.id,
          descricao: entry.description,
          valor: `${entry.type === "PAYABLE" ? "−" : "+"}${money(entry.amount)}`,
          vencimento: formatBrazilDate(entry.dueDate),
        })),
        totalCount: dueSoon.length,
      },
    };
  },
};

const spentByCategory: AstroQuery = {
  key: "payment.spent_by_category",
  app: "payment",
  appKey: "financeiro",
  matches: (text) => /\b(gastei|gastamos|gasto|gastos|despesas?)\b/.test(text) && /\b(com|em|de)\b/.test(text),
  run: async ({ ctx, text }) => {
    const categories = await prisma.paymentCategory.findMany({
      where: { organizationId: ctx.organizationId, type: { in: ["EXPENSE", "COST"] } },
      select: { id: true, name: true },
    });
    const category = categories.find((item) => mentions(text, item.name));
    if (!category) return null;
    const period = periodFrom(text);
    const entries = await prisma.paymentEntry.findMany({
      where: {
        organizationId: ctx.organizationId,
        type: "PAYABLE",
        status: "PAID",
        categoryId: category.id,
        ...(period ? { paidAt: { gte: period.since, lt: period.until } } : {}),
      },
      select: { paidAmount: true },
    });
    const total = entries.reduce((sum, entry) => sum + entry.paidAmount, 0);
    return {
      text: `Gasto com ${category.name}${period ? ` ${period.label}` : ""}: ${money(total)} em ${entries.length} ${plural(entries.length, "lançamento", "lançamentos")}.`,
    };
  },
};

export const ANALYSIS_QUERIES: AstroQuery[] = [
  leadsByPerson,
  leadsComparison,
  filteredLeads,
  waitingConversations,
  freeSlots,
  openProposalsValue,
  dueEntries,
  spentByCategory,
];

