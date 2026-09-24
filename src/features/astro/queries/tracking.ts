import "server-only";
import prisma from "@/lib/prisma";
import { ASKS, plural, type AstroQuery } from "./types";

// Consultas do Tracking — leads, funis, etapas, tags.

const LEAD = /\blead|\bleads|\bclientes?\b|\bcontatos?\b/;

const countLeads: AstroQuery = {
  key: "tracking.leads_count",
  app: "tracking",
  matches: (text) => ASKS.test(text) && LEAD.test(text) && !/\betapa|coluna|status|tag|sem responsavel|hoje\b/.test(text),
  run: async (ctx) => {
    const trackings = await prisma.tracking.findMany({
      where: { organizationId: ctx.organizationId },
      select: { id: true, name: true, _count: { select: { leads: true } } },
      orderBy: { name: "asc" },
    });
    if (trackings.length === 0) {
      return { text: "Você ainda não tem nenhum tracking, então não há leads." };
    }
    const total = trackings.reduce((sum, item) => sum + item._count.leads, 0);
    const label = plural(total, "lead", "leads");
    if (trackings.length === 1) {
      return { text: `Você tem ${total} ${label} em ${trackings[0].name}.` };
    }
    return {
      text: `Você tem ${total} ${label} no total, distribuídos assim:`,
      table: {
        kind: "astro_table",
        entityType: "tracking",
        title: `${total} ${label}`,
        columns: [
          { key: "name", label: "Tracking" },
          { key: "leads", label: "Leads", type: "number" },
        ],
        rows: trackings.map((item) => ({
          id: item.id,
          name: item.name,
          leads: item._count.leads,
        })),
        totalCount: trackings.length,
      },
    };
  },
};

const listTrackings: AstroQuery = {
  key: "tracking.list",
  app: "tracking",
  matches: (text) => ASKS.test(text) && /\btracking|trackings|funil|funis\b/.test(text) && !LEAD.test(text),
  run: async (ctx) => {
    const trackings = await prisma.tracking.findMany({
      where: { organizationId: ctx.organizationId },
      select: { id: true, name: true, _count: { select: { leads: true } } },
      orderBy: { name: "asc" },
    });
    if (trackings.length === 0) return { text: "Você ainda não tem nenhum tracking." };
    return {
      text: trackings.length === 1 ? "Você tem 1 tracking:" : `Você tem ${trackings.length} trackings:`,
      table: {
        kind: "astro_table",
        entityType: "tracking",
        title: "Seus trackings",
        columns: [
          { key: "name", label: "Tracking" },
          { key: "leads", label: "Leads", type: "number" },
        ],
        rows: trackings.map((item) => ({
          id: item.id,
          name: item.name,
          leads: item._count.leads,
        })),
        totalCount: trackings.length,
      },
    };
  },
};

const leadsByStatus: AstroQuery = {
  key: "tracking.leads_by_status",
  app: "tracking",
  matches: (text) => ASKS.test(text) && LEAD.test(text) && /\betapa|coluna|status|funil\b/.test(text),
  run: async (ctx) => {
    const statuses = await prisma.status.findMany({
      where: { tracking: { organizationId: ctx.organizationId } },
      select: {
        id: true,
        name: true,
        tracking: { select: { name: true } },
        _count: { select: { leads: true } },
      },
      orderBy: [{ trackingId: "asc" }, { order: "asc" }],
    });
    if (statuses.length === 0) return { text: "Nenhuma etapa configurada ainda." };
    const total = statuses.reduce((sum, item) => sum + item._count.leads, 0);
    return {
      text: `${total} ${plural(total, "lead", "leads")} distribuídos pelas etapas:`,
      table: {
        kind: "astro_table",
        entityType: "tracking",
        title: "Leads por etapa",
        columns: [
          { key: "name", label: "Etapa" },
          { key: "tracking", label: "Tracking" },
          { key: "leads", label: "Leads", type: "number" },
        ],
        rows: statuses.map((item) => ({
          id: item.id,
          name: item.name,
          tracking: item.tracking.name,
          leads: item._count.leads,
        })),
        totalCount: statuses.length,
      },
    };
  },
};

const unassignedLeads: AstroQuery = {
  key: "tracking.leads_unassigned",
  app: "tracking",
  matches: (text) => LEAD.test(text) && /\bsem responsavel|sem dono|nao atribuidos?|sem atendente\b/.test(text),
  run: async (ctx) => {
    const count = await prisma.lead.count({
      where: {
        responsibleId: null,
        tracking: { organizationId: ctx.organizationId },
      },
    });
    return {
      text:
        count === 0
          ? "Todos os leads têm responsável."
          : `${count} ${plural(count, "lead está", "leads estão")} sem responsável.`,
    };
  },
};

const listTags: AstroQuery = {
  key: "tracking.tags_list",
  app: "tracking",
  matches: (text) => ASKS.test(text) && /\btags?|etiquetas?\b/.test(text),
  run: async (ctx) => {
    const tags = await prisma.tag.findMany({
      where: { organizationId: ctx.organizationId },
      select: { id: true, name: true, _count: { select: { leadTags: true } } },
      orderBy: { name: "asc" },
      take: 30,
    });
    if (tags.length === 0) return { text: "Nenhuma tag cadastrada." };
    return {
      text: `Você tem ${tags.length} ${plural(tags.length, "tag", "tags")}:`,
      table: {
        kind: "astro_table",
        entityType: "tracking",
        title: "Tags",
        columns: [
          { key: "name", label: "Tag" },
          { key: "leads", label: "Leads", type: "number" },
        ],
        rows: tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          leads: tag._count.leadTags,
        })),
        totalCount: tags.length,
      },
    };
  },
};

export const TRACKING_QUERIES: AstroQuery[] = [
  unassignedLeads,
  leadsByStatus,
  listTags,
  countLeads,
  listTrackings,
];
