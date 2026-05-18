import { z } from "zod";
import { callNerpProcedure } from "../_call";
import type { NerpOrgConfig } from "../types";
import { listStocksInputSchema, listStocksOutputSchema } from "./schemas";

export type ListStocksInput = z.infer<typeof listStocksInputSchema>;

// `stocks.list` no nerp é GET. Mutações de estoque acontecem via
// `stocks.register-entry`/`register-output`/`register-purchase`, que têm
// semântica de movimento (não CRUD) — quando o NASA precisar disparar
// movimentação, expor wrappers dedicados com esses nomes.
//
// Quirk: o handler do nerp calcula `skip = (offset - 1) * limit`. Com o
// default `offset = 0` do servidor, `skip` vira -10 e o Prisma rejeita
// (`Invalid value for skip argument`). Espelhamos paginação 1-based aqui
// pra evitar 500 — primeira página = offset 1.
export async function listStocks(cfg: NerpOrgConfig, input: ListStocksInput) {
  const normalized = {
    ...input,
    offset: Math.max(1, input.offset ?? 1),
    limit: input.limit ?? 10,
  };
  const raw = await callNerpProcedure<unknown>(cfg, "stocks.list", normalized, {
    method: "GET",
  });
  return listStocksOutputSchema.parse(raw);
}
