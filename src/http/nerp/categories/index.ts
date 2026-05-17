import { z } from "zod";
import { callNerpProcedure } from "../_call";
import type { NerpOrgConfig } from "../types";
import {
  listCategoriesInputSchema,
  listCategoriesOutputSchema,
  createCategoryInputSchema,
  updateCategoryInputSchema,
  deleteCategoryInputSchema,
  nerpCategorySchema,
} from "./schemas";

export type ListCategoriesInput = z.infer<typeof listCategoriesInputSchema>;
export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;
export type DeleteCategoryInput = z.infer<typeof deleteCategoryInputSchema>;

export async function listCategories(cfg: NerpOrgConfig, input: ListCategoriesInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "categories.list", input);
  return listCategoriesOutputSchema.parse(raw);
}

export async function createCategory(cfg: NerpOrgConfig, input: CreateCategoryInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "categories.create", input);
  return z.object({ category: nerpCategorySchema }).parse(raw).category;
}

export async function updateCategory(cfg: NerpOrgConfig, input: UpdateCategoryInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "categories.update", input);
  return z.object({ category: nerpCategorySchema }).parse(raw).category;
}

export async function deleteCategory(cfg: NerpOrgConfig, input: DeleteCategoryInput) {
  return callNerpProcedure<unknown>(cfg, "categories.delete", input);
}
