import { z } from "zod";

const nerpDashboardLatestSaleSchema = z.object({
  id: z.string(),
  createdAt: z.union([z.string(), z.date()]),
  quantity: z.number(),
  previousStock: z.number(),
  newStock: z.number(),
  notes: z.string().nullable(),
  total: z.number(),
  status: z.string(),
  product: z.object({
    id: z.string(),
    name: z.string(),
    sku: z.string().nullable(),
    createdAt: z.union([z.string(), z.date()]),
  }),
  customer: z.object({
    id: z.string(),
    name: z.string(),
  }),
});

const nerpDashboardLowStockSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string().nullable(),
  stock: z.number(),
  stockMin: z.number(),
});

// Shape real do `dashboard.list` (sem wrapper) — agrega métricas + listas
// de últimas vendas e produtos com estoque baixo.
export const nerpDashboardSchema = z.object({
  salesTotal: z.number(),
  totalSinceLastMonth: z.number(),
  productsActive: z.number(),
  productAddedToday: z.number(),
  productsLowStock: z.number(),
  lowStockFromYesterdayToToday: z.number(),
  salesToday: z.number(),
  salesFromYesterdayToToday: z.number(),
  latestSales: z.array(nerpDashboardLatestSaleSchema),
  productWithLowStock: z.array(nerpDashboardLowStockSchema),
});

export type NerpDashboard = z.infer<typeof nerpDashboardSchema>;

// `dashboard.list` aceita `z.object({})` (input vazio).
export const getDashboardInputSchema = z.object({}).optional();
