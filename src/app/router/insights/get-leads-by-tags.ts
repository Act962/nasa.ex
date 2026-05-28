import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { getTagSnapshotAtDate } from "@/features/insights/lib/tag-snapshot";

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

      // Para cada tag, contar leads que TINHAM ela em `endDate`.
      // Usa SNAPSHOT TEMPORAL (lib/tag-snapshot) — reconstrói via
      // LeadJourneyEvent. Sem isso, remover tag HOJE caía retroativamente
      // o count de PERÍODOS PASSADOS (bug crítico).
      //
      // Quando não há endDate (ou está no futuro), o helper já cai pro
      // caminho rápido (LeadTag vivo) automaticamente.
      const leadsInScope = await prisma.lead.findMany({
        where: baseWhere,
        select: { id: true },
      });
      const snapshot = await getTagSnapshotAtDate(
        leadsInScope.map((l) => l.id),
        endDate ? new Date(endDate) : null,
      );
      // Agrupa snapshot por tagId pra contagem
      const countByTagId = new Map<string, number>();
      const leadsByTagId = new Map<string, Set<string>>();
      for (const s of snapshot) {
        countByTagId.set(s.tagId, (countByTagId.get(s.tagId) ?? 0) + 1);
        const set = leadsByTagId.get(s.tagId) ?? new Set();
        set.add(s.leadId);
        leadsByTagId.set(s.tagId, set);
      }

      const tagCounts = tags.map((tag) => {
        const { archivedAt, ...tagPublic } = tag;
        return {
          tag: { ...tagPublic, isArchived: archivedAt !== null },
          count: countByTagId.get(tag.id) ?? 0,
        };
      });

      // Total de leads com PELO MENOS 1 tag no endDate (também via snapshot)
      const leadsWithAnyTag = new Set<string>();
      for (const set of leadsByTagId.values()) {
        for (const id of set) leadsWithAnyTag.add(id);
      }
      const totalWithTags = leadsWithAnyTag.size;

      return {
        tags: tagCounts.sort((a, b) => b.count - a.count),
        totalWithTags,
      };
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
