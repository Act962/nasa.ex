import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Lê N relatórios salvos e extrai a evolução das campanhas Meta entre eles.
 *
 * Cada relatório salvo inclui em `snapshot.metaAds.campaigns[]` os KPIs por
 * campanha no momento do snapshot. Aqui agrupamos por `metaCampaignId`
 * (estável) e retornamos uma série temporal pronta pra plotar.
 *
 * Quando o usuário renomeia uma campanha entre dois relatórios, mostramos o
 * nome MAIS RECENTE (do snapshot mais novo onde a campanha apareceu).
 */
export const getCampaignsEvolution = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      reportIds: z.array(z.string().min(1)).min(1).max(50),
    }),
  )
  .handler(async ({ input, context }) => {
    const reports = await prisma.savedInsightReport.findMany({
      where: {
        organizationId: context.org.id,
        id: { in: input.reportIds },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        snapshot: true,
      },
    });

    type CampaignKpis = {
      metaCampaignId: string;
      name: string;
      spend: number;
      leads: number;
      conversions: number;
      roas: number;
      ctr: number;
      cpc: number;
      cpm: number;
      cpa: number;
      impressions: number;
      reach: number;
      clicks: number;
    };

    type Point = CampaignKpis & {
      reportId: string;
      savedAt: string;
    };

    const reportsOut = reports.map((r) => {
      const snap = (r.snapshot ?? {}) as Record<string, unknown>;
      const meta = (snap.metaAds ?? null) as Record<string, unknown> | null;
      const period = (snap.period ?? null) as
        | { startDate?: string; endDate?: string }
        | null;
      return {
        id: r.id,
        name: r.name,
        savedAt: r.createdAt.toISOString(),
        periodFrom: period?.startDate ?? null,
        periodTo: period?.endDate ?? null,
        adAccountId: (meta?.adAccountId as string | undefined) ?? null,
        adAccountName: (meta?.adAccountName as string | undefined) ?? null,
        hasCampaigns: Array.isArray(meta?.campaigns) && (meta!.campaigns as unknown[]).length > 0,
      };
    });

    // Agrupa por metaCampaignId
    const byCampaign = new Map<
      string,
      { name: string; lastSavedAt: number; points: Point[] }
    >();

    for (const r of reports) {
      const snap = (r.snapshot ?? {}) as Record<string, unknown>;
      const meta = (snap.metaAds ?? null) as Record<string, unknown> | null;
      const campaigns = (meta?.campaigns ?? []) as Partial<CampaignKpis>[];
      const savedAtMs = r.createdAt.getTime();

      for (const c of campaigns) {
        if (!c.metaCampaignId) continue;
        const num = (v: unknown): number =>
          typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : 0;
        const point: Point = {
          reportId: r.id,
          savedAt: r.createdAt.toISOString(),
          metaCampaignId: c.metaCampaignId,
          name: c.name ?? c.metaCampaignId,
          spend: num(c.spend),
          leads: num(c.leads),
          conversions: num(c.conversions),
          roas: num(c.roas),
          ctr: num(c.ctr),
          cpc: num(c.cpc),
          cpm: num(c.cpm),
          cpa: num(c.cpa),
          impressions: num(c.impressions),
          reach: num(c.reach),
          clicks: num(c.clicks),
        };

        const existing = byCampaign.get(c.metaCampaignId);
        if (!existing) {
          byCampaign.set(c.metaCampaignId, {
            name: point.name,
            lastSavedAt: savedAtMs,
            points: [point],
          });
        } else {
          existing.points.push(point);
          // Mantém o nome do snapshot mais recente
          if (savedAtMs >= existing.lastSavedAt) {
            existing.name = point.name;
            existing.lastSavedAt = savedAtMs;
          }
        }
      }
    }

    // Converte e calcula deltas (primeiro vs último ponto)
    const KPI_KEYS = [
      "spend", "leads", "conversions", "roas", "ctr",
      "cpc", "cpm", "cpa", "impressions", "reach", "clicks",
    ] as const;

    const campaigns = Array.from(byCampaign.entries())
      .map(([metaCampaignId, info]) => {
        const points = info.points.sort(
          (a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime(),
        );
        const first = points[0];
        const last = points[points.length - 1];

        const delta: Record<string, { first: number; last: number; pctChange: number | null }> = {};
        for (const k of KPI_KEYS) {
          const f = first[k];
          const l = last[k];
          delta[k] = {
            first: f,
            last: l,
            pctChange: f === 0 ? (l === 0 ? 0 : null) : ((l - f) / f) * 100,
          };
        }

        return {
          metaCampaignId,
          name: info.name,
          pointCount: points.length,
          points,
          delta,
        };
      })
      // Ordena por gasto total decrescente (campanhas mais relevantes primeiro)
      .sort((a, b) => {
        const sa = a.points.reduce((s, p) => s + p.spend, 0);
        const sb = b.points.reduce((s, p) => s + p.spend, 0);
        return sb - sa;
      });

    return {
      reports: reportsOut,
      campaigns,
      reportsMissingCampaigns: reportsOut.filter((r) => !r.hasCampaigns).map((r) => r.id),
    };
  });
