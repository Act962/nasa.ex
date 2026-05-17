import { z } from "zod";

export const nerpDashboardSchema = z.object({
  totals: z
    .object({
      revenue: z.number().optional(),
      sales: z.number().int().optional(),
      products: z.number().int().optional(),
      customers: z.number().int().optional(),
    })
    .partial(),
  topProducts: z
    .array(
      z.object({
        productId: z.string(),
        name: z.string(),
        revenue: z.number(),
        units: z.number().int(),
      }),
    )
    .optional(),
  recentSales: z
    .array(
      z.object({
        id: z.string(),
        total: z.number(),
        createdAt: z.string(),
      }),
    )
    .optional(),
  rawMetrics: z.record(z.string(), z.unknown()).optional(),
});

export type NerpDashboard = z.infer<typeof nerpDashboardSchema>;

export const getDashboardInputSchema = z
  .object({
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    range: z.enum(["7d", "30d", "90d", "365d"]).optional(),
  })
  .optional();

export const getDashboardOutputSchema = z.object({
  dashboard: nerpDashboardSchema,
});
