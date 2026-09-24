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

    const trackings = await prisma.tracking.findMany({
      where: {
        organizationId: org.id,
        participants: { some: { userId: user.id } },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return {
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
