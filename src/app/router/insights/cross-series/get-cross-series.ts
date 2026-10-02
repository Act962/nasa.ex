import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { z } from "zod";
import { findCrossDataset, MAX_CROSS_SERIES } from "@/features/insights/lib/cross-chart-catalog";
import { resolveInsightsOrganizationIds } from "../resolve-insights-organizations";
import { buildCrossScope, resolveSeriesRange } from "./cross-scope";
import { PERIOD_LOADERS, type DatedValue } from "./period-loaders";
import { loadDimensionDataset } from "./dimension-loaders";
import { listBuckets, pickBucket, toBucketSeries, toRelativeLabels } from "./period-buckets";

/**
 * Dados do Gráfico Cruzado: cada série vem com os próprios filtros (período, empresas e os do App
 * dela). O menu do Insights não influencia aqui. Séries por período usam a mesma régua de datas —
 * a união dos períodos de todas — para os pontos de séries diferentes caírem no mesmo rótulo.
 */

const idList = z.array(z.string()).optional();

const seriesFiltersSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  organizationIds: idList,
  trackingIds: idList,
  tagIds: idList,
  statusIds: idList,
  memberIds: idList,
  workspaceIds: idList,
  paymentAccountIds: idList,
  paymentCategoryIds: idList,
});

export const getCrossSeries = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      bucket: z.enum(["auto", "day", "week", "month"]).default("auto"),
      // Alinha cada série pelo início do próprio período (Semana 1, 2…) em vez da data — compara agosto × setembro.
      alignPeriods: z.boolean().default(false),
      series: z
        .array(z.object({ seriesId: z.string(), datasetId: z.string(), filters: seriesFiltersSchema }))
        .max(MAX_CROSS_SERIES),
    }),
  )
  .handler(async ({ input, context }) => {
    const knownSeries = input.series.flatMap((series) => {
      const dataset = findCrossDataset(series.datasetId);
      return dataset ? [{ ...series, dataset }] : [];
    });

    const periodSeries = knownSeries.filter((series) => series.dataset.axis === "period");
    const periodRanges = periodSeries.map((series) => resolveSeriesRange(series.filters));
    const unionStart = periodRanges.length > 0 ? new Date(Math.min(...periodRanges.map((range) => range.gte.getTime()))) : new Date();
    const unionEnd = periodRanges.length > 0 ? new Date(Math.max(...periodRanges.map((range) => range.lte.getTime()))) : new Date();
    const longestRange = periodRanges.reduce(
      (longest, range) => (range.lte.getTime() - range.gte.getTime() > longest.lte.getTime() - longest.gte.getTime() ? range : longest),
      { gte: unionStart, lte: unionStart },
    );
    const bucket =
      input.bucket !== "auto"
        ? input.bucket
        : input.alignPeriods
          ? pickBucket(longestRange.gte, longestRange.lte)
          : pickBucket(unionStart, unionEnd);
    const buckets = listBuckets(unionStart, unionEnd, bucket);

    const resolvedSeries = await Promise.all(
      knownSeries.map(async (series) => {
        const organizationIds = await resolveInsightsOrganizationIds({
          userId: context.user.id,
          activeOrganizationId: context.org.id,
          requestedOrganizationIds: series.filters.organizationIds,
        });
        const scope = buildCrossScope(series.dataset, series.filters, organizationIds);
        try {
          if (series.dataset.axis === "period") {
            const loadPeriod = PERIOD_LOADERS[series.dataset.id];
            const datedValues: DatedValue[] = loadPeriod ? await loadPeriod(scope) : [];
            if (input.alignPeriods) {
              const ownBuckets = listBuckets(scope.range.gte, scope.range.lte, bucket);
              return [series.seriesId, toRelativeLabels(toBucketSeries(datedValues, ownBuckets, bucket), bucket)] as const;
            }
            return [series.seriesId, toBucketSeries(datedValues, buckets, bucket)] as const;
          }
          return [series.seriesId, await loadDimensionDataset(series.dataset.axis, series.dataset.id, scope)] as const;
        } catch (loadError) {
          // Uma série que falha vira vazia; as outras continuam aparecendo.
          console.warn(`[insights/cross] série ${series.dataset.id} falhou:`, loadError);
          return [series.seriesId, []] as const;
        }
      }),
    );

    return { bucket, seriesData: Object.fromEntries(resolvedSeries) };
  });
