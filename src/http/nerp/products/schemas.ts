import { z } from "zod";

export const nerpProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  price: z.number().nullable().optional(),
  cost: z.number().nullable().optional(),
  stock: z.number().nullable().optional(),
  categoryId: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type NerpProduct = z.infer<typeof nerpProductSchema>;

export const nerpStockMovementSchema = z.object({
  id: z.string(),
  productId: z.string(),
  type: z.string().optional(),
  quantity: z.number(),
  createdAt: z.string().optional(),
});

export const listProductsInputSchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
  sortBy: z.enum(["name", "createdAt", "price"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

export const listProductsOutputSchema = z.object({
  products: z.array(nerpProductSchema),
  page: z.number().int().optional(),
  pageSize: z.number().int().optional(),
  totalCount: z.number().int().optional(),
  totalPages: z.number().int().optional(),
  hasNextPage: z.boolean().optional(),
  hasPreviousPage: z.boolean().optional(),
});

export const getProductInputSchema = z.object({ id: z.string() });
export const getProductOutputSchema = z.object({
  product: nerpProductSchema,
  stockMovements: z.array(nerpStockMovementSchema).optional(),
});

export const createProductInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sku: z.string().optional(),
  price: z.number().nonnegative().optional(),
  cost: z.number().nonnegative().optional(),
  stock: z.number().int().nonnegative().optional(),
  categoryId: z.string().optional(),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateProductInputSchema = createProductInputSchema
  .partial()
  .extend({ id: z.string() });

export const duplicateProductInputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
});

export const deleteProductInputSchema = z.object({ id: z.string() });
