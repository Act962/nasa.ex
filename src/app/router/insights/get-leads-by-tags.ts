import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getLeadsByTags = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/reports/insights/leads-by-tags",
    summary: "Get lead count grouped by tags for a tracking",
  })
  .input(
    z.object({
      trackingId: z.string().optional(),
      tagIds: z.array(z.string()).optional(), // filtrar por tags específicas
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      /** Inclui tags arquivadas (soft-deleted) na lista. Default false —
       *  charts mostram só tags ativas pra não poluir. Toggle "Incluir
       *  arquivadas" no front liga isso pra análise histórica. */
      includeArchived: z.boolean().optional().default(false),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const { org } = context;
      const { trackingId, tagIds, startDate, endDate, includeArchived } = input;

      const dateFilter =
        startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {};

      const baseWhere = {
        ...(trackingId ? { trackingId } : {}),
        tracking: { organizationId: org.id },
        ...dateFilter,
      };

      // Buscar tags do tracking/org. Por default exclui arquivadas; com
      // `includeArchived=true` traz todas (útil pra análise histórica).
      const tags = await prisma.tag.findMany({
        where: {
          organizationId: org.id,
          ...(tagIds?.length ? { id: { in: tagIds } } : {}),
          ...(trackingId ? { OR: [{ trackingId }, { trackingId: null }] } : {}),
          ...(includeArchived ? {} : { archivedAt: null }),
        },
        select: {
          id: true,
          name: true,
          color: true,
          slug: true,
          archivedAt: true,
        },
      });

      // Para cada tag, contar leads associados no tracking.
      // Anota `isArchived` no payload pra UI mostrar badge "arquivada"
      // quando includeArchived=true.
      const tagCounts = await Promise.all(
        tags.map(async (tag) => {
          const count = await prisma.leadTag.count({
            where: {
              tagId: tag.id,
              lead: baseWhere,
            },
          });
          const { archivedAt, ...tagPublic } = tag;
          return {
            tag: { ...tagPublic, isArchived: archivedAt !== null },
            count,
          };
        }),
      );

      // Total de leads com pelo menos 1 tag
      const totalWithTags = await prisma.lead.count({
        where: {
          ...baseWhere,
          leadTags: { some: {} },
        },
      });

      return {
        tags: tagCounts.sort((a, b) => b.count - a.count),
        totalWithTags,
      };
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
