import "server-only";
import prisma from "@/lib/prisma";
import type { AstroQuery } from "./types";

// Lead pelo id. Só procura dentro da org de quem pergunta: id de outra
// empresa responde "não achei", nunca o dado (F7-05, isolamento por org).

const LEAD_ID = /\b(?:id|codigo)\s*:?\s*([a-z0-9]{20,32})\b/;

const leadById: AstroQuery = {
  key: "tracking.lead_by_id",
  app: "tracking",
  appKey: "tracking",
  matches: (text) => /\blead\b/.test(text) && LEAD_ID.test(text),
  run: async ({ ctx, text }) => {
    const leadId = text.match(LEAD_ID)?.[1];
    if (!leadId) return null;
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tracking: { organizationId: ctx.organizationId } },
      select: { name: true, phone: true, email: true, tracking: { select: { name: true } }, status: { select: { name: true } } },
    });
    if (!lead) return { text: "Não achei lead com esse id nesta empresa." };
    return {
      text:
        `${lead.name} — ${lead.tracking.name}, etapa ${lead.status.name}.` +
        (lead.phone ? ` Telefone ${lead.phone}.` : "") +
        (lead.email ? ` E-mail ${lead.email}.` : ""),
    };
  },
};

export const LEAD_LOOKUP_QUERIES: AstroQuery[] = [leadById];
