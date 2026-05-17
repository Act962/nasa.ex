import { z } from "zod";
import { callNerpProcedure } from "../_call";
import type { NerpOrgConfig } from "../types";
import {
  listSalesInputSchema,
  listSalesOutputSchema,
  getSaleInputSchema,
  nerpSaleSchema,
  createSaleInputSchema,
  createSaleOutputSchema,
} from "./schemas";

export type ListSalesInput = z.infer<typeof listSalesInputSchema>;
export type GetSaleInput = z.infer<typeof getSaleInputSchema>;
export type CreateSaleInput = z.infer<typeof createSaleInputSchema>;

// `sales.list` e `sales.get` são GET no nerp; `sales.create` é POST.
// `sales.get` devolve o objeto direto (sem wrapper `{ sale }`). `update` e
// `delete` não existem — vendas são imutáveis após criação.
export async function listSales(cfg: NerpOrgConfig, input: ListSalesInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "sales.list", input, {
    method: "GET",
  });
  return listSalesOutputSchema.parse(raw);
}
export async function getSale(cfg: NerpOrgConfig, input: GetSaleInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "sales.get", input, {
    method: "GET",
  });
  return nerpSaleSchema.parse(raw);
}
export async function createSale(cfg: NerpOrgConfig, input: CreateSaleInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "sales.create", input);
  return createSaleOutputSchema.parse(raw);
}
