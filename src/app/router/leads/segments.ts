import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import {
  LOYAL_MESSAGE_COUNT,
  NEW_LEAD_DAYS,
  RISK_DAYS,
  buildScopeWhere,
  loyalLeadIds,
  segmentWhere,
} from "./segment-rules";

/**
 * Contagem dos segmentos do cabeçalho de /contatos.
 *
 * As réguas ficam aqui, explícitas, porque "leal" e "em risco" não têm
 * definição óbvia — e número sem régua declarada é número que ninguém
 * consegue conferir:
 *
 * - Novos      → criados nos últimos 30 dias e ainda no funil
 * - Campeões   → ganhos (`currentAction: WON`)
 * - Leais      → ganhos mais de uma vez, ou com conversa de 10+ mensagens
 * - Em risco   → ativos e sem mensagem recebida há mais de 7 dias
 *                (o mesmo `stuckDays` do resgate de leads)
 */

export const leadSegments = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      trackingId: z.string().optional(),
      tagIds: z.array(z.string()).optional(),
      /** Qual data o recorte olha — nascer no funil ou dar sinal de vida. */
      dateField: z.enum(["createdAt", "lastInboundAt"]).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }).optional(),
  )
  .handler(async ({ input, context }) => {
    const { org, user } = context;

    const scope = {
      tracking: {
        organizationId: org.id,
        participants: { some: { userId: user.id } },
      },
      ...buildScopeWhere(input),
    };

    const [total, novos, campeoes, emRisco, tags] = await Promise.all([
      prisma.lead.count({ where: scope }),
      prisma.lead.count({ where: { ...scope, ...segmentWhere("novos") } }),
      prisma.lead.count({ where: { ...scope, ...segmentWhere("campeoes") } }),
      prisma.lead.count({ where: { ...scope, ...segmentWhere("risco") } }),
      prisma.tag.findMany({
        where: { organizationId: org.id },
        select: { id: true, name: true, color: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const leais = (await loyalLeadIds(prisma, scope)).length;

    // Série dos últimos 7 dias para o minigráfico. Só onde há data para
    // contar: "leal" e "em risco" são fotografias do agora, não acumulam por
    // dia, e inventar uma curva para eles seria mentir com pixel.
    const SERIES_DAYS = 7;
    const seriesStart = new Date();
    seriesStart.setHours(0, 0, 0, 0);
    seriesStart.setDate(seriesStart.getDate() - (SERIES_DAYS - 1));

    const [createdRows, wonRows] = await Promise.all([
      prisma.lead.findMany({
        where: { ...scope, createdAt: { gte: seriesStart } },
        select: { createdAt: true },
      }),
      prisma.lead.findMany({
        where: { ...scope, currentAction: "WON", closedAt: { gte: seriesStart } },
        select: { closedAt: true },
      }),
    ]);

    const bucketize = (dates: Array<Date | null>) => {
      const buckets = Array.from({ length: SERIES_DAYS }, () => 0);
      for (const date of dates) {
        if (!date) continue;
        const day = Math.floor(
          (date.getTime() - seriesStart.getTime()) / (24 * 60 * 60_000),
        );
        if (day >= 0 && day < SERIES_DAYS) buckets[day] += 1;
      }
      return buckets;
    };

    const novosSeries = bucketize(createdRows.map((row) => row.createdAt));
    const campeoesSeries = bucketize(wonRows.map((row) => row.closedAt));

    /** Últimos 3 dias contra os 3 anteriores — tendência, não previsão. */
    const trendOf = (series: number[]): number | null => {
      const half = Math.floor(series.length / 2);
      const older = series.slice(0, half).reduce((sum, value) => sum + value, 0);
      const recent = series.slice(-half).reduce((sum, value) => sum + value, 0);
      if (older === 0) return recent > 0 ? 100 : null;
      return ((recent - older) / older) * 100;
    };

    const trackings = await prisma.tracking.findMany({
      where: {
        organizationId: org.id,
        participants: { some: { userId: user.id } },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return {
      series: {
        total: novosSeries,
        novos: novosSeries,
        campeoes: campeoesSeries,
      },
      trends: {
        total: trendOf(novosSeries),
        novos: trendOf(novosSeries),
        campeoes: trendOf(campeoesSeries),
      },
      total,
      novos,
      campeoes,
      leais,
      emRisco,
      trackings,
      tags,
      regras: {
        novosDias: NEW_LEAD_DAYS,
        riscoDias: RISK_DAYS,
        leaisMensagens: LOYAL_MESSAGE_COUNT,
      },
    };
  });
