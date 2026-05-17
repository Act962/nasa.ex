import { z } from "zod";
import { callNerpProcedure } from "../_call";
import type { NerpOrgConfig } from "../types";
import {
  listSalesInputSchema,
  listSalesOutputSchema,
  getSaleInputSchema,
  getSaleOutputSchema,
  createSaleInputSchema,
  nerpSaleSchema,
} from "./schemas";

export type ListSalesInput = z.infer<typeof listSalesInputSchema>;
export type GetSaleInput = z.infer<typeof getSaleInputSchema>;
export type CreateSaleInput = z.infer<typeof createSaleInputSchema>;

// Nerp expõe apenas `sales.list`, `sales.get` e `sales.create`.
// `update` e `delete` não existem (vendas são imutáveis após criação).
export async function listSales(cfg: NerpOrgConfig, input: ListSalesInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "sales.list", input);
  return listSalesOutputSchema.parse(raw);
}
export async function getSale(cfg: NerpOrgConfig, input: GetSaleInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "sales.get", input);
  return getSaleOutputSchema.parse(raw).sale;
}
export async function createSale(cfg: NerpOrgConfig, input: CreateSaleInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "sales.create", input);
  return z.object({ sale: nerpSaleSchema }).parse(raw).sale;
}
