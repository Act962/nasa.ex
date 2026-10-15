import { z } from "zod";
import { callNerpProcedure } from "../_call";
import type { NerpOrgConfig } from "../types";
import {
  listProductsInputSchema,
  listProductsOutputSchema,
  getProductInputSchema,
  getProductOutputSchema,
  createProductInputSchema,
  updateProductInputSchema,
  duplicateProductInputSchema,
  deleteProductInputSchema,
  mutateProductOutputSchema,
} from "./schemas";

export type ListProductsInput = z.infer<typeof listProductsInputSchema>;
export type GetProductInput = z.infer<typeof getProductInputSchema>;
export type CreateProductInput = z.infer<typeof createProductInputSchema>;
export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;
export type DuplicateProductInput = z.infer<typeof duplicateProductInputSchema>;
export type DeleteProductInput = z.infer<typeof deleteProductInputSchema>;

const DEFAULT_PAGE_SIZE = 20;

const NERP_SORT: Record<string, string> = {
  "name:asc": "name-asc",
  "name:desc": "name-desc",
  "salePrice:asc": "price-asc",
  "salePrice:desc": "price-desc",
  "createdAt:desc": "recent",
};

const nerpListResponseSchema = z.object({
  products: z.array(z.unknown()),
  totalCount: z.number().int().optional(),
});

/**
 * O nerp pagina por cursor (`limit` obrigatório) e a tela do Órbita por página numerada. Para a página N pede os
 * N × pageSize primeiros e devolve a última fatia: listas de cadastro são curtas na navegação e isso evita guardar cursor.
 */
export async function listProducts(cfg: NerpOrgConfig, input: ListProductsInput) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
  const sort = input.sortBy ? NERP_SORT[`${input.sortBy}:${input.sortDir ?? "asc"}`] : undefined;
  const raw = await callNerpProcedure<unknown>(cfg, "products.list", {
    search: input.search,
    category: input.categoryId ? [input.categoryId] : undefined,
    limit: page * pageSize,
    ...(sort ? { sort } : {}),
  });
  const response = nerpListResponseSchema.parse(raw);
  const totalCount = response.totalCount ?? response.products.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  return listProductsOutputSchema.parse({
    products: response.products.slice((page - 1) * pageSize),
    page,
    pageSize,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  });
}

export async function getProduct(cfg: NerpOrgConfig, input: GetProductInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "products.get", input);
  return getProductOutputSchema.parse(raw);
}

export async function createProduct(cfg: NerpOrgConfig, input: CreateProductInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "products.create", input);
  return mutateProductOutputSchema.parse(raw);
}

export async function updateProduct(cfg: NerpOrgConfig, input: UpdateProductInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "products.update", input);
  return mutateProductOutputSchema.parse(raw);
}

// `products.duplicate` no nerp é declarado como GET (`.route({ method: "GET" })`).
export async function duplicateProduct(cfg: NerpOrgConfig, input: DuplicateProductInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "products.duplicate", input, {
    method: "GET",
  });
  return mutateProductOutputSchema.parse(raw);
}

export async function deleteProduct(cfg: NerpOrgConfig, input: DeleteProductInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "products.delete", input);
  return mutateProductOutputSchema.parse(raw);
}
