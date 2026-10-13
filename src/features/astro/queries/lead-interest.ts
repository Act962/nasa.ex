import "server-only";
import prisma from "@/lib/prisma";
import { plural, type AstroQuery } from "./types";

// "Quais leads com interesse alto?" (spec 0085): lê a Visão do Lead já
// calculada. Em código, sem IA.

const MAX_ROWS = 30;

type InterestLevel = "LOW" | "MEDIUM" | "HIGH";

const INTEREST_WORDS: Array<{ level: InterestLevel; pattern: RegExp; label: string }> = [
  { level: "HIGH", pattern: /\b(alto|alta|altos|altas|maior|quentes?)\b/, label: "alto" },
  { level: "MEDIUM", pattern: /\b(medio|media|medios|medias)\b/, label: "médio" },
  { level: "LOW", pattern: /\b(baixo|baixa|baixos|baixas|menor)\b/, label: "baixo" },
];

const leadsByInterest: AstroQuery = {
  key: "tracking.leads_by_interest",
  app: "tracking",
  appKey: "tracking",
  matches: (text) =>
    /\b(leads?|clientes?|contatos?)\b/.test(text) && /\b(interesse|potencial)\b/.test(text),
  run: async ({ ctx, text }) => {
    const interest = INTEREST_WORDS.find((word) => word.pattern.test(text)) ?? INTEREST_WORDS[0];
    const where = {
      tracking: { organizationId: ctx.organizationId },
      isActive: true,
      metrics: { interestLevel: interest.level },
    };
    const [leads, totalLeads, auditedLeads] = await Promise.all([
      prisma.lead.findMany({
        where,
        select: {
          id: true,
          name: true,
          status: { select: { name: true } },
          tracking: { select: { name: true } },
          metrics: { select: { purchasePotential: true } },
        },
        orderBy: { metrics: { purchasePotential: "desc" } },
        take: MAX_ROWS,
      }),
      prisma.lead.count({ where }),
      prisma.leadMetrics.count({ where: { lead: { tracking: { organizationId: ctx.organizationId } } } }),
    ]);
    if (auditedLeads === 0) {
      return { text: "Nenhum lead tem a Visão do Lead calculada ainda. Ela é preenchida quando o lead conversa ou quando você clica em Auditar Lead." };
    }
    if (leads.length === 0) return { text: `Nenhum lead com interesse ${interest.label} no momento.` };
    return {
      text: `${totalLeads} ${plural(totalLeads, "lead", "leads")} com interesse ${interest.label}, do maior potencial para o menor:`,
      table: {
        kind: "astro_table",
        entityType: "lead",
        title: `Leads com interesse ${interest.label}`,
        columns: [
          { key: "name", label: "Lead" },
          { key: "potential", label: "Potencial" },
          { key: "status", label: "Etapa" },
          { key: "tracking", label: "Funil" },
        ],
        rows: leads.map((lead) => ({
          id: lead.id,
          name: lead.name,
          potential: `${lead.metrics?.purchasePotential ?? 0}%`,
          status: lead.status?.name ?? "—",
          tracking: lead.tracking?.name ?? "—",
        })),
        totalCount: totalLeads,
      },
    };
  },
};

export const LEAD_INTEREST_QUERIES: AstroQuery[] = [leadsByInterest];
