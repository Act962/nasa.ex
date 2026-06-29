import { z } from "zod";
import { callNerpProcedure } from "../_call";
import type { NerpOrgConfig } from "../types";
import {
  listCategoriesInputSchema,
  listCategoriesOutputSchema,
  createCategoryInputSchema,
  updateCategoryInputSchema,
  deleteCategoryInputSchema,
  mutateCategoryOutputSchema,
} from "./schemas";

export type ListCategoriesInput = z.infer<typeof listCategoriesInputSchema>;
export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;
export type DeleteCategoryInput = z.infer<typeof deleteCategoryInputSchema>;

// Métodos espelham `.route({ method })` declarados em nerp/router/category/*:
// list → GET, create → POST, update → PUT, delete → DELETE. O RPCHandler do
// nerp honra esses métodos no protocolo Standard RPC (mismatch retorna 404/405).
export async function listCategories(cfg: NerpOrgConfig, input?: ListCategoriesInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "categories.list", input, {
    method: "GET",
  });
  return listCategoriesOutputSchema.parse(raw);
}

export async function createCategory(cfg: NerpOrgConfig, input: CreateCategoryInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "categories.create", input);
  return mutateCategoryOutputSchema.parse(raw);
}

export async function updateCategory(cfg: NerpOrgConfig, input: UpdateCategoryInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "categories.update", input, {
    method: "PUT",
  });
  return mutateCategoryOutputSchema.parse(raw);
}

export async function deleteCategory(cfg: NerpOrgConfig, input: DeleteCategoryInput) {
  return callNerpProcedure<unknown>(cfg, "categories.delete", input, {
    method: "DELETE",
  });
}
