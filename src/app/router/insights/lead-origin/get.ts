import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../../middlewares/auth";
import { requireOrgMiddleware } from "../../../middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Dashboard de origem do lead — fonte única para os 3 cards do painel:
 *  1. Distribuição por canal (`Lead.source` enum)
 *  2. Top campanhas Meta (JOIN Lead.metaCampaignId ↔ MetaAdCampaign.metaCampaignId)
 *  3. Top UTMs (utm_campaign / utm_source)
 */
export const getLeadOrigin = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/insights/lead-origin",
    summary: "Dashboard de origem dos leads (canal + Meta Ads + UTMs)",
  })
  .input(
    z.object({
      organizationIds: z.array(z.string()).optional(),
      trackingId: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { org } = context;
    const orgIds =
      input.organizationIds && input.organizationIds.length > 0
        ? input.organizationIds
        : [org.id];

    const dateFilter =
      input.startDate || input.endDate
        ? {
            createdAt: {
              ...(input.startDate ? { gte: new Date(input.startDate) } : {}),
              ...(input.endDate ? { lte: new Date(input.endDate) } : {}),
            },
          }
        : {};

    const where = {
      tracking: { organizationId: { in: orgIds } },
      ...(input.trackingId ? { trackingId: input.trackingId } : {}),
      ...dateFilter,
    };

    // Todas as 6 groupBy queries são independentes — paraleliza
    const [
      bySource,
      wonBySource,
      byMetaCampaign,
      wonByMetaCampaign,
      byUtmCampaign,
      byUtmSource,
    ] = await Promise.all([
      prisma.lead.groupBy({
        by: ["source"],
        where,
        _count: { id: true },
      }),
      prisma.lead.groupBy({
        by: ["source"],
        where: { ...where, currentAction: "WON" },
        _count: { id: true },
      }),
      prisma.lead.groupBy({
        by: ["metaCampaignId"],
        where: { ...where, metaCampaignId: { not: null } },
        _count: { id: true },
      }),
      prisma.lead.groupBy({
        by: ["metaCampaignId"],
        where: { ...where, metaCampaignId: { not: null }, currentAction: "WON" },
        _count: { id: true },
      }),
      prisma.lead.groupBy({
        by: ["utmCampaign"],
        where: { ...where, utmCampaign: { not: null } },
        _count: { id: true },
      }),
      prisma.lead.groupBy({
        by: ["utmSource"],
        where: { ...where, utmSource: { not: null } },
        _count: { id: true },
      }),
    ]);

    const wonSourceMap = Object.fromEntries(
      wonBySource.map((r) => [r.source, r._count.id]),
    );
    const totalLeads = bySource.reduce((s, r) => s + r._count.id, 0);

    const sourceLabels: Record<string, string> = {
      DEFAULT: "Manual",
      WHATSAPP: "WhatsApp",
      FORM: "Formulário",
      AGENDA: "Agenda",
      INSTAGRAM: "Instagram",
      TIKTOK: "TikTok",
      LINKEDIN: "LinkedIn",
      GMAIL: "Gmail",
      GOOGLE_MAPS: "Google Maps",
      OTHER: "Outro",
    };

    const channels = bySource
      .map((r) => {
        const won = wonSourceMap[r.source] ?? 0;
        return {
          source: r.source,
          label: sourceLabels[r.source] ?? r.source,
          count: r._count.id,
          won,
          conversionRate:
            r._count.id > 0 ? Math.round((won / r._count.id) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.count - a.count);

    // Top campanhas Meta — agora só falta o lookup dos nomes
    const wonMetaMap = Object.fromEntries(
      wonByMetaCampaign.map((r) => [r.metaCampaignId ?? "", r._count.id]),
    );
    const metaCampaignIds = byMetaCampaign
      .map((r) => r.metaCampaignId)
      .filter((id): id is string => !!id);
    const metaCampaigns = metaCampaignIds.length
      ? await prisma.metaAdCampaign.findMany({
          where: { metaCampaignId: { in: metaCampaignIds } },
          select: { metaCampaignId: true, name: true, objective: true },
        })
      : [];
    const metaCampaignNameMap = Object.fromEntries(
      metaCampaigns.map((c) => [c.metaCampaignId, c]),
    );
    const topMetaCampaigns = byMetaCampaign
      .map((r) => {
        const meta = r.metaCampaignId
          ? metaCampaignNameMap[r.metaCampaignId]
          : null;
        const won = wonMetaMap[r.metaCampaignId ?? ""] ?? 0;
        return {
          metaCampaignId: r.metaCampaignId,
          name: meta?.name ?? r.metaCampaignId ?? "Desconhecida",
          objective: meta?.objective ?? null,
          count: r._count.id,
          won,
          conversionRate:
            r._count.id > 0 ? Math.round((won / r._count.id) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topUtmCampaigns = byUtmCampaign
      .map((r) => ({
        utmCampaign: r.utmCampaign ?? "(sem campanha)",
        count: r._count.id,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topUtmSources = byUtmSource
      .map((r) => ({
        utmSource: r.utmSource ?? "(sem fonte)",
        count: r._count.id,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalLeads,
      channels,
      topMetaCampaigns,
      topUtmCampaigns,
      topUtmSources,
    };
  });
