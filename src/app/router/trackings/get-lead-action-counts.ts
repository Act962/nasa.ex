import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { base } from "@/app/middlewares/base";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Retorna um mapa `leadId → { total, done }` das actions vinculadas aos leads
 * de um tracking, pro contador do card do lead.
 *
 * Conta apenas actions não-arquivadas, pra bater com o que o sheet mostra
 * (o board embutido usa `isArchived: false` por default).
 *
 * Leads sem action não entram no mapa — o card trata ausência como "sem
 * ações", então o payload é O(leads-com-ações), não O(leads).
 *
 * Chamado uma vez por board: todos os cards usam a mesma queryKey e o React
 * Query dedupa numa request só.
 */
export const getLeadActionCounts = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Get done/total action counts for the leads of a tracking",
    tags: ["Trackings"],
  })
  .input(
    z.object({
      trackingId: z.string(),
    }),
  )
  .output(
    z.object({
      counts: z.record(
        z.string(),
        z.object({
          total: z.number(),
          done: z.number(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    // As guardas ficam FORA do try: dentro, o catch as converteria em
    // INTERNAL_SERVER_ERROR e o 403/404 chegaria no cliente como 500.
    const [tracking, member] = await Promise.all([
      prisma.tracking.findFirst({
        where: { id: input.trackingId, organizationId: context.org.id },
        select: { id: true },
      }),
      prisma.member.findUnique({
        where: {
          userId_organizationId: {
            userId: context.user.id,
            organizationId: context.org.id,
          },
        },
        select: { role: true },
      }),
    ]);

    if (!tracking) {
      throw errors.NOT_FOUND({ message: "Tracking não encontrado" });
    }

    if (!member) {
      throw errors.FORBIDDEN({ message: "Sem permissão" });
    }

    // Espelha o filtro de `action.listByColumn`: quem é `member` só enxerga
    // as actions que criou ou participa. Sem isso o contador prometeria
    // ações que o sheet não mostraria.
    const visibilityFilter: Prisma.ActionWhereInput =
      member.role === "member"
        ? {
            OR: [
              { createdBy: context.user.id },
              { participants: { some: { userId: context.user.id } } },
            ],
          }
        : {};

    try {
      // Agrupa pelo booleano em vez de dois counts: Prisma não tem agregado
      // condicional, e assim sai no máximo 2 linhas por lead numa ida só.
      const rows = await prisma.action.groupBy({
        by: ["leadId", "isDone"],
        where: {
          leadId: { not: null },
          isArchived: false,
          lead: { trackingId: input.trackingId },
          ...visibilityFilter,
        },
        _count: { _all: true },
      });

      const counts: Record<string, { total: number; done: number }> = {};

      for (const row of rows) {
        if (!row.leadId) continue;

        const entry = counts[row.leadId] ?? { total: 0, done: 0 };
        entry.total += row._count._all;
        if (row.isDone) entry.done += row._count._all;
        counts[row.leadId] = entry;
      }

      return { counts };
    } catch (err) {
      console.error("[trackings/getLeadActionCounts]", err);
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Erro ao contar ações do lead",
      });
    }
  });
