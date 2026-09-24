import "server-only";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroTablePayload } from "@/features/astro/lib/astro-table";

/**
 * Consultas que o Astro responde em código, sem IA.
 *
 * "Quantos leads temos?" chegava ao orquestrador, gastava 43 mil tokens e
 * voltava "não tenho acesso aos dados" — o modelo do nível SMART, diante de
 * ~91 ferramentas, respondia sem chamar nenhuma. Contar linha em tabela não
 * precisa de modelo nenhum: é `count()`.
 *
 * Cada consulta é um par frase→query. Não classifica nada: se o texto casa,
 * responde; se não casa, o pedido segue o caminho de sempre.
 */

export interface AstroQueryResult {
  text: string;
  table?: AstroTablePayload;
}

export interface AstroQuery {
  key: string;
  matches: (normalizedText: string) => boolean;
  run: (ctx: AgentContext) => Promise<AstroQueryResult | null>;
}

export function normalizeQuestion(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const countLeads: AstroQuery = {
  key: "leads.count",
  matches: (text) =>
    /\b(quantos|qual o numero de|qual a quantidade de|total de)\b/.test(text) &&
    /\blead/.test(text),
  run: async (ctx) => {
    const trackings = await prisma.tracking.findMany({
      where: { organizationId: ctx.organizationId },
      select: { id: true, name: true, _count: { select: { leads: true } } },
      orderBy: { name: "asc" },
    });
    if (trackings.length === 0) {
      return { text: "Você ainda não tem nenhum tracking, então não há leads." };
    }

    const total = trackings.reduce(
      (sum, tracking) => sum + tracking._count.leads,
      0,
    );
    const plural = total === 1 ? "lead" : "leads";

    if (trackings.length === 1) {
      return {
        text: `Você tem ${total} ${plural} em ${trackings[0].name}.`,
      };
    }

    return {
      text: `Você tem ${total} ${plural} no total, distribuídos assim:`,
      table: {
        kind: "astro_table",
        entityType: "tracking",
        title: `${total} ${plural}`,
        columns: [
          { key: "name", label: "Tracking" },
          { key: "leads", label: "Leads", type: "number" },
        ],
        rows: trackings.map((tracking) => ({
          id: tracking.id,
          name: tracking.name,
          leads: tracking._count.leads,
        })),
        totalCount: trackings.length,
      },
    };
  },
};

const listTrackings: AstroQuery = {
  key: "trackings.list",
  matches: (text) =>
    /\b(quais|que|liste|lista|me mostra|quantos)\b/.test(text) &&
    /\b(tracking|trackings|funil|funis)\b/.test(text) &&
    !/\blead/.test(text),
  run: async (ctx) => {
    const trackings = await prisma.tracking.findMany({
      where: { organizationId: ctx.organizationId },
      select: { id: true, name: true, _count: { select: { leads: true } } },
      orderBy: { name: "asc" },
    });
    if (trackings.length === 0) {
      return { text: "Você ainda não tem nenhum tracking." };
    }
    return {
      text:
        trackings.length === 1
          ? "Você tem 1 tracking:"
          : `Você tem ${trackings.length} trackings:`,
      table: {
        kind: "astro_table",
        entityType: "tracking",
        title: "Seus trackings",
        columns: [
          { key: "name", label: "Tracking" },
          { key: "leads", label: "Leads", type: "number" },
        ],
        rows: trackings.map((tracking) => ({
          id: tracking.id,
          name: tracking.name,
          leads: tracking._count.leads,
        })),
        totalCount: trackings.length,
      },
    };
  },
};

const listAgendas: AstroQuery = {
  key: "agendas.list",
  matches: (text) =>
    /\b(quais|que|liste|lista|me mostra|quantas)\b/.test(text) &&
    /\bagendas?\b/.test(text),
  run: async (ctx) => {
    const agendas = await prisma.agenda.findMany({
      where: { organizationId: ctx.organizationId },
      select: { id: true, name: true, isActive: true },
      orderBy: { name: "asc" },
    });
    if (agendas.length === 0) return { text: "Você ainda não tem nenhuma agenda." };
    return {
      text:
        agendas.length === 1
          ? "Você tem 1 agenda:"
          : `Você tem ${agendas.length} agendas:`,
      table: {
        kind: "astro_table",
        entityType: "agenda",
        title: "Suas agendas",
        columns: [
          { key: "name", label: "Agenda" },
          { key: "situacao", label: "Situação", type: "badge" },
        ],
        rows: agendas.map((agenda) => ({
          id: agenda.id,
          name: agenda.name,
          situacao: agenda.isActive ? "Ativa" : "Inativa",
        })),
        totalCount: agendas.length,
      },
    };
  },
};

export const ASTRO_QUERIES: AstroQuery[] = [countLeads, listTrackings, listAgendas];

/** Primeira consulta que casa. `null` = ninguém aqui responde isso. */
export async function runAstroQuery(params: {
  ctx: AgentContext;
  text: string;
}): Promise<{ key: string; result: AstroQueryResult } | null> {
  const normalized = normalizeQuestion(params.text);
  for (const query of ASTRO_QUERIES) {
    if (!query.matches(normalized)) continue;
    const result = await query.run(params.ctx);
    if (result) return { key: query.key, result };
  }
  return null;
}
