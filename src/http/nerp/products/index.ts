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

export async function listProducts(cfg: NerpOrgConfig, input: ListProductsInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "products.list", input);
  return listProductsOutputSchema.parse(raw);
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
