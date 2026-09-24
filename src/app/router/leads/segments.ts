import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import { DEFAULT_RESCUE_CONFIG } from "@/lib/lead-journey/sla";

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

const NEW_LEAD_DAYS = 30;
const LOYAL_MESSAGE_COUNT = 10;

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
    const now = Date.now();
    const newSince = new Date(now - NEW_LEAD_DAYS * 24 * 60 * 60_000);
    const riskSince = new Date(
      now - DEFAULT_RESCUE_CONFIG.stuckDays * 24 * 60 * 60_000,
    );

    // O recorte de data vale para TODOS os cards, inclusive o total: um
    // painel em que cada número olha um período diferente não se soma.
    const dateField = input?.dateField ?? "createdAt";
    const from = input?.from ? new Date(input.from) : undefined;
    const to = input?.to ? new Date(input.to) : undefined;
    const dateFilter =
      from || to
        ? {
            [dateField]: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {};

    const scope = {
      tracking: {
        organizationId: org.id,
        participants: { some: { userId: user.id } },
      },
      ...(input?.trackingId ? { trackingId: input.trackingId } : {}),
      ...(input?.tagIds && input.tagIds.length > 0
        ? { tags: { some: { tagId: { in: input.tagIds } } } }
        : {}),
      ...dateFilter,
      isArchived: false,
    };

    const [total, novos, campeoes, emRisco, tags] = await Promise.all([
      prisma.lead.count({ where: scope }),
      prisma.lead.count({
        where: { ...scope, currentAction: "ACTIVE", createdAt: { gte: newSince } },
      }),
      prisma.lead.count({ where: { ...scope, currentAction: "WON" } }),
      prisma.lead.count({
        where: {
          ...scope,
          currentAction: "ACTIVE",
          OR: [
            { lastInboundAt: { lt: riskSince } },
            { lastInboundAt: null, createdAt: { lt: riskSince } },
          ],
        },
      }),
      prisma.tag.findMany({
        where: { organizationId: org.id },
        select: { id: true, name: true, color: true },
        orderBy: { name: "asc" },
      }),
    ]);

    // Leal exige volume de conversa; o count acima é só o recorte grosso.
    const comConversa = await prisma.lead.findMany({
      where: {
        ...scope,
        conversation: { messages: { some: {} } },
      },
      select: { id: true, conversation: { select: { _count: { select: { messages: true } } } } },
      take: 2000,
    });
    const leais = comConversa.filter(
      (lead) => (lead.conversation?._count.messages ?? 0) >= LOYAL_MESSAGE_COUNT,
    ).length;

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
        riscoDias: DEFAULT_RESCUE_CONFIG.stuckDays,
        leaisMensagens: LOYAL_MESSAGE_COUNT,
      },
    };
  });
