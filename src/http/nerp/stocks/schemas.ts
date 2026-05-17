import { z } from "zod";

export const nerpStockMovementSchema = z.object({
  id: z.string(),
  productId: z.string(),
  quantity: z.number(),
  warehouseId: z.string().optional().nullable(),
  type: z.string().optional(),
  reason: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type NerpStockMovement = z.infer<typeof nerpStockMovementSchema>;

export const listStocksInputSchema = z.object({
  productId: z.string().optional(),
  warehouseId: z.string().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
});

export const listStocksOutputSchema = z.object({
  movements: z.array(nerpStockMovementSchema),
});
