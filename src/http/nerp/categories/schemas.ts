import { z } from "zod";

// Filho retornado dentro de `categories.list` no nerp. A própria resposta
// inclui `children` aninhada (1 nível) — não é hierarquia arbitrária.
export const nerpCategoryChildSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  productsCount: z.number().int(),
  parentId: z.string().nullable(),
});

export const nerpCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  productsCount: z.number().int(),
  children: z.array(nerpCategoryChildSchema).default([]),
});

export type NerpCategory = z.infer<typeof nerpCategorySchema>;
export type NerpCategoryChild = z.infer<typeof nerpCategoryChildSchema>;

// `categories.list` no nerp é GET puro (sem filtros — devolve todas
// categorias top-level com children).
export const listCategoriesInputSchema = z.object({}).optional();
export const listCategoriesOutputSchema = z.object({
  categories: z.array(nerpCategorySchema),
});

// `categories.create`/`update` exigem `slug`. Retornam só `{ categoryName }`.
export const createCategoryInputSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  parentId: z.string().optional(),
});

export const updateCategoryInputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  slug: z.string().optional(),
  description: z.string().optional(),
  parentId: z.string().optional(),
});

export const mutateCategoryOutputSchema = z
  .object({
    categoryName: z.string().optional(),
  })
  .passthrough();

export const deleteCategoryInputSchema = z.object({ id: z.string() });
