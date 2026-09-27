import "server-only";
import prisma from "@/lib/prisma";
import { ASKS, periodFrom, plural, startOfToday, type AstroQuery } from "./types";

// Leads respondidos no período: entraram e já receberam mensagem da equipe.
// Existe pela pergunta composta "quantos entraram hoje e quantos foram
// respondidos?" (F5-CRS-01), que só tinha a primeira metade atendida.

const DAY_MS = 24 * 60 * 60_000;

const leadsAnswered: AstroQuery = {
  key: "tracking.leads_answered",
  app: "tracking",
  appKey: "tracking",
  matches: (text) => ASKS.test(text) && /\bleads?\b/.test(text) && /\b(respondid[oa]s?|atendid[oa]s?)\b/.test(text),
  run: async ({ ctx, text }) => {
    const today = startOfToday();
    const period = periodFrom(text) ?? {
      since: today,
      until: new Date(today.getTime() + DAY_MS),
      label: "hoje",
    };
    const createdInPeriod = {
      tracking: { organizationId: ctx.organizationId },
      createdAt: { gte: period.since, lt: period.until },
    };
    const [entered, answered] = await Promise.all([
      prisma.lead.count({ where: createdInPeriod }),
      prisma.lead.count({
        where: { ...createdInPeriod, conversation: { messages: { some: { fromMe: true } } } },
      }),
    ]);
    return {
      text:
        `${answered} ${plural(answered, "lead foi respondido", "leads foram respondidos")} ` +
        `dos ${entered} que entraram ${period.label}.`,
    };
  },
};

export const RESPONSE_QUERIES: AstroQuery[] = [leadsAnswered];
