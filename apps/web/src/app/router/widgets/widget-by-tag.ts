import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { getTagSnapshotAtDate } from "@/features/insights/lib/tag-snapshot";

/**
 * Widget "Por tags" do dashboard de Insights — contagem de leads que TINHAM
 * a tag em endDate. Antes usava `leadTag.count` (estado VIVO atual) e ignorava
 * filtro de data, então sempre mostrava 6 mesmo filtrando ontem (27.05).
 *
 * Agora respeita os mesmos filtros do dashboard (endDate, trackingId, memberIds)
 * e usa o snapshot histórico — mesmo helper que getTrackingDashboardReport.
 *
 * Também agrega contagem de tags duplicadas pelo nome (lowercased trim) —
 * se "Empresa" existe com 3 IDs diferentes (migração TagsV2 detectou mas não
 * mergeou), o widget soma. Lookup pelo nome da tag original do widget.
 */
export const getWidgetByTag = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/widgets/by-tag",
    summary: "Get leads count by tag (snapshot histórico)",
  })
  .input(
    z.object({
      tagId: z.string(),
      organizationId: z.string(),
      /** Filtros do dashboard pra alinhar com getTrackingDashboardReport */
      endDate: z.string().optional(),
      trackingId: z.string().optional(),
      memberIds: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { tagId, organizationId, endDate, trackingId, memberIds } = input;

    const tag = await prisma.tag.findUnique({
      where: { id: tagId },
      select: { color: true, name: true },
    });

    if (!tag) return { count: 0, color: null };

    // Encontra TODOS os IDs de tags com mesmo nome (lowercased trim) na org
    // — duplicatas legacy da migração viram contagem somada.
    const sameNameTags = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM tags
      WHERE organization_id = ${organizationId}
        AND archived_at IS NULL
        AND LOWER(TRIM(name)) = LOWER(TRIM(${tag.name}))
    `;
    const equivalentTagIds = new Set(sameNameTags.map((t) => t.id));

    // Scope de leads — mesma lógica do snapshot do dashboard
    const hasMembers = !!memberIds && memberIds.length > 0;
    const leads = await prisma.lead.findMany({
      where: {
        ...(trackingId && trackingId !== "ALL" ? { trackingId } : {}),
        tracking: { organizationId },
        ...(hasMembers ? { responsibleId: { in: memberIds } } : {}),
      },
      select: { id: true },
    });

    const snapshot = await getTagSnapshotAtDate(
      leads.map((l) => l.id),
      endDate ? new Date(endDate) : null,
    );

    // Conta leads UNIQUE que tinham QUALQUER tag equivalente (dedupe duplicatas)
    const leadIds = new Set<string>();
    for (const s of snapshot) {
      if (equivalentTagIds.has(s.tagId)) leadIds.add(s.leadId);
    }

    return { count: leadIds.size, color: tag.color };
  });
