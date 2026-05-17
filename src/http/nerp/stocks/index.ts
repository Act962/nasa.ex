import { z } from "zod";
import { callNerpProcedure } from "../_call";
import type { NerpOrgConfig } from "../types";
import { listStocksInputSchema, listStocksOutputSchema } from "./schemas";

export type ListStocksInput = z.infer<typeof listStocksInputSchema>;

// Nerp expõe apenas `stocks.list`. Mutações de estoque acontecem via
// `stocks.register-entry` / `register-output` / `register-purchase`,
// que têm semântica de movimento (não CRUD). Wrappers serão adicionados
// quando o NASA precisar disparar movimentações específicas.
export async function listStocks(cfg: NerpOrgConfig, input: ListStocksInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "stocks.list", input);
  return listStocksOutputSchema.parse(raw);
}
