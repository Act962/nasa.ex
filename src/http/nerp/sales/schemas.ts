import { z } from "zod";

export const nerpSaleItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const nerpSaleSchema = z.object({
  id: z.string(),
  customerId: z.string().optional().nullable(),
  status: z
    .enum(["draft", "pending", "paid", "canceled", "refunded"])
    .optional(),
  items: z.array(nerpSaleItemSchema),
  subtotal: z.number().optional(),
  discount: z.number().optional(),
  total: z.number().optional(),
  paymentMethod: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type NerpSale = z.infer<typeof nerpSaleSchema>;
export type NerpSaleItem = z.infer<typeof nerpSaleItemSchema>;

export const listSalesInputSchema = z.object({
  customerId: z.string().optional(),
  status: z
    .enum(["draft", "pending", "paid", "canceled", "refunded"])
    .optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
});

export const listSalesOutputSchema = z.object({
  sales: z.array(nerpSaleSchema),
});

export const getSaleInputSchema = z.object({ id: z.string() });
export const getSaleOutputSchema = z.object({ sale: nerpSaleSchema });

export const createSaleInputSchema = z.object({
  customerId: z.string().optional(),
  items: z.array(nerpSaleItemSchema).min(1),
  discount: z.number().nonnegative().optional(),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
