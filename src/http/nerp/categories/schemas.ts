import { z } from "zod";

export const nerpCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  productsCount: z.number().int().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type NerpCategory = z.infer<typeof nerpCategorySchema>;

export const listCategoriesInputSchema = z.object({
  search: z.string().optional(),
  parentId: z.string().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
});

export const listCategoriesOutputSchema = z.object({
  categories: z.array(nerpCategorySchema),
});

export const createCategoryInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  parentId: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updateCategoryInputSchema = createCategoryInputSchema
  .partial()
  .extend({ id: z.string() });

export const deleteCategoryInputSchema = z.object({ id: z.string() });
