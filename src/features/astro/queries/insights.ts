import "server-only";
import prisma from "@/lib/prisma";
import { computeFunnel } from "@/features/insights/lib/metrics/funnel";
import { computeWonLeads } from "@/features/insights/lib/metrics/won-leads";
import { computeSoldThisMonth } from "@/features/insights/lib/metrics/sold-this-month";
import { computeAcquisitionChannels } from "@/features/insights/lib/metrics/acquisition-channels";
import { periodFrom, plural, type AstroQuery } from "./types";

/**
 * Relatórios de Insights respondidos em código.
 *
 * O cálculo NÃO é reescrito aqui: são os mesmos `compute*` que as procedures
 * da tela usam. Duplicar a conta faria o Astro e o dashboard discordarem, e
 * um número que não bate com a tela é pior do que número nenhum.
 */

/** O funil é de UM tracking; com vários, é preciso escolher. */
async function pickTracking(organizationId: string, hint?: string) {
  const trackings = await prisma.tracking.findMany({
    where: {
      organizationId,
      ...(hint ? { name: { contains: hint, mode: "insensitive" } } : {}),
    },
    select: { id: true, name: true },
    take: 8,
  });
  return trackings;
}

function percent(value: number): string {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

const funnelQuery: AstroQuery = {
  key: "insights.funnel",
  app: "insights",
  appKey: "insights",
  matches: (text) =>
    /\bfunil|etapas?\b/.test(text) &&
    /\b(como|analise|analisa|desempenho|conversao|travad|parad|gargalo|tempo)\b/.test(text),
  run: async ({ ctx, text }) => {
    const trackings = await pickTracking(ctx.organizationId);
    if (trackings.length === 0) return { text: "Você ainda não tem tracking nenhum." };

    // Com vários funis o número agregado mente: cada um tem etapas próprias.
    const named = trackings.find((tracking) =>
      text.includes(tracking.name.toLowerCase()),
    );
    const chosen = named ?? (trackings.length === 1 ? trackings[0] : null);
    if (!chosen) {
      return {
        text:
          `O funil é de um tracking só. Qual deles?\n` +
          trackings.map((item, index) => `*${index + 1}.* ${item.name}`).join("\n"),
      };
    }

    const period = periodFrom(text);
    const result = await computeFunnel({
      organizationIds: [ctx.organizationId],
      trackingId: chosen.id,
      startDate: period?.since,
      endDate: period?.until,
    });
    if (!result || result.stages.length === 0) {
      return { text: `${chosen.name} não tem etapas configuradas.` };
    }

    return {
      text: `Funil de ${chosen.name} — ${result.total} ${plural(result.total, "lead", "leads")}:`,
      table: {
        kind: "astro_table",
        entityType: "tracking",
        title: `Funil · ${chosen.name}`,
        columns: [
          { key: "etapa", label: "Etapa" },
          { key: "leads", label: "Leads", type: "number" },
          { key: "tempo", label: "Tempo médio" },
          { key: "queda", label: "Queda" },
        ],
        rows: result.stages.map((stage) => ({
          id: stage.statusId,
          etapa: stage.name,
          leads: stage.count,
          tempo: stage.avgTimeHours > 0 ? `${stage.avgTimeHours.toFixed(0)}h` : "—",
          queda: stage.dropoffFromPrevious > 0 ? percent(stage.dropoffPercent) : "—",
        })),
        totalCount: result.stages.length,
      },
    };
  },
};

const wonLostQuery: AstroQuery = {
  key: "insights.won_lost",
  app: "insights",
  appKey: "insights",
  matches: (text) =>
    /\b(ganhei|ganhos?|fechei|fechamentos?|perdi|perdidos?|conversao|taxa de conversao|ganhos e perdas)\b/.test(text) &&
    !/\bmes\b/.test(text),
  run: async ({ ctx, text }) => {
    const period = periodFrom(text);
    const result = await computeWonLeads({
      organizationId: ctx.organizationId,
      startDate: period?.since,
      endDate: period?.until,
    });
    const quando = period ? ` ${period.label}` : "";
    const motivos =
      result.wonByReason.length > 0
        ? "\n\nPrincipais motivos de ganho:\n" +
          result.wonByReason
            .slice(0, 5)
            .map((item) => `• ${item.reason?.name ?? "Sem motivo"} — ${item.count}`)
            .join("\n")
        : "";
    return {
      text:
        `Ganhos${quando}: ${result.wonCount}. Perdidos: ${result.lostCount}. ` +
        `Taxa de conversão: ${percent(result.conversionRate)}.${motivos}`,
    };
  },
};

const soldMonthQuery: AstroQuery = {
  key: "insights.sold_month",
  app: "insights",
  appKey: "insights",
  matches: (text) =>
    /\b(vendi|vendas|fechei|fechamentos?|ganhos?)\b/.test(text) && /\bmes\b/.test(text),
  run: async ({ ctx }) => {
    const result = await computeSoldThisMonth({ organizationId: ctx.organizationId });
    const variacao =
      result.growthRate === null
        ? "sem base de comparação"
        : `${result.growthRate >= 0 ? "+" : ""}${percent(result.growthRate)} contra o mês passado`;
    return {
      text:
        `${result.currentMonth.label}: ${result.currentMonth.count} ${plural(result.currentMonth.count, "fechamento", "fechamentos")}. ` +
        `${result.lastMonth.label}: ${result.lastMonth.count}. ${variacao}.`,
    };
  },
};

const channelsQuery: AstroQuery = {
  key: "insights.channels",
  app: "insights",
  appKey: "insights",
  matches: (text) =>
    /\b(canal|canais|origem|de onde vem|de onde vieram|aquisicao)\b/.test(text),
  run: async ({ ctx, text }) => {
    const period = periodFrom(text);
    const result = await computeAcquisitionChannels({
      organizationId: ctx.organizationId,
      startDate: period?.since,
      endDate: period?.until,
    });
    if (result.total === 0) {
      return { text: period ? `Nenhum lead ${period.label}.` : "Nenhum lead ainda." };
    }
    return {
      text: `${result.total} ${plural(result.total, "lead", "leads")}${period ? ` ${period.label}` : ""}, por canal:`,
      table: {
        kind: "astro_table",
        entityType: "lead",
        title: "Canais de aquisição",
        columns: [
          { key: "canal", label: "Canal" },
          { key: "leads", label: "Leads", type: "number" },
          { key: "fatia", label: "Fatia" },
          { key: "conversao", label: "Conversão" },
        ],
        rows: result.channels.map((channel) => ({
          id: channel.source,
          canal: channel.label,
          leads: channel.count,
          fatia: percent(channel.percentage),
          conversao: percent(channel.conversionRate),
        })),
        totalCount: result.channels.length,
      },
    };
  },
};

const attendantsQuery: AstroQuery = {
  key: "insights.attendants",
  app: "insights",
  appKey: "insights",
  matches: (text) =>
    /\b(atendente|atendentes|quem atendeu|por vendedor|equipe|por responsavel)\b/.test(text) ||
    // "responsável" sozinho é ambíguo: "leads sem responsável" é outra
    // consulta, e ela vem antes na ordem — aqui só o positivo.
    /\b(quem|quais)\b.*\bresponsavel\b/.test(text),
  run: async ({ ctx, text }) => {
    const period = periodFrom(text);
    const grouped = await prisma.lead.groupBy({
      by: ["responsibleId"],
      where: {
        tracking: { organizationId: ctx.organizationId },
        responsibleId: { not: null },
        ...(period ? { createdAt: { gte: period.since, lt: period.until } } : {}),
      },
      _count: { _all: true },
      orderBy: { _count: { responsibleId: "desc" } },
      take: 15,
    });
    if (grouped.length === 0) {
      return { text: "Nenhum lead com responsável no período." };
    }
    const users = await prisma.user.findMany({
      where: { id: { in: grouped.map((row) => row.responsibleId!) } },
      select: { id: true, name: true },
    });
    const nameOf = (id: string) =>
      users.find((user) => user.id === id)?.name ?? "Sem nome";
    const total = grouped.reduce((sum, row) => sum + row._count._all, 0);
    return {
      text: `${total} ${plural(total, "lead", "leads")}${period ? ` ${period.label}` : ""}, por responsável:`,
      table: {
        kind: "astro_table",
        entityType: "user",
        title: "Leads por responsável",
        columns: [
          { key: "pessoa", label: "Responsável" },
          { key: "leads", label: "Leads", type: "number" },
        ],
        rows: grouped.map((row) => ({
          id: row.responsibleId!,
          pessoa: nameOf(row.responsibleId!),
          leads: row._count._all,
        })),
        totalCount: grouped.length,
      },
    };
  },
};

const leadsByTagQuery: AstroQuery = {
  key: "insights.leads_by_tag",
  app: "insights",
  appKey: "tracking",
  matches: (text) => /\blead/.test(text) && /\b(tag|etiqueta)/.test(text),
  run: async ({ ctx, text }) => {
    const period = periodFrom(text);
    const tags = await prisma.tag.findMany({
      where: { organizationId: ctx.organizationId },
      select: { id: true, name: true },
    });
    // Tag citada na frase responde só por ela; sem citar, mostra todas.
    const named = tags.find((tag) => text.includes(tag.name.toLowerCase()));

    const counts = await prisma.leadTag.groupBy({
      by: ["tagId"],
      where: {
        ...(named ? { tagId: named.id } : {}),
        lead: {
          tracking: { organizationId: ctx.organizationId },
          ...(period ? { createdAt: { gte: period.since, lt: period.until } } : {}),
        },
      },
      _count: { _all: true },
    });

    if (counts.length === 0) {
      return {
        text: named
          ? `Nenhum lead com a tag "${named.name}"${period ? ` ${period.label}` : ""}.`
          : `Nenhum lead etiquetado${period ? ` ${period.label}` : ""}.`,
      };
    }

    if (named) {
      const count = counts[0]._count._all;
      return {
        text: `${count} ${plural(count, "lead", "leads")} com a tag "${named.name}"${period ? ` ${period.label}` : ""}.`,
      };
    }

    const nameOf = (id: string) => tags.find((tag) => tag.id === id)?.name ?? "—";
    return {
      text: `Leads por tag${period ? ` ${period.label}` : ""}:`,
      table: {
        kind: "astro_table",
        entityType: "lead",
        title: "Leads por tag",
        columns: [
          { key: "tag", label: "Tag" },
          { key: "leads", label: "Leads", type: "number" },
        ],
        rows: counts.map((row) => ({
          id: row.tagId,
          tag: nameOf(row.tagId),
          leads: row._count._all,
        })),
        totalCount: counts.length,
      },
    };
  },
};

export const INSIGHTS_QUERIES: AstroQuery[] = [
  leadsByTagQuery,
  funnelQuery,
  wonLostQuery,
  soldMonthQuery,
  channelsQuery,
  attendantsQuery,
];
