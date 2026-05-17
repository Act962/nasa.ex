import { callNerpProcedure } from "../_call";
import type { NerpOrgConfig } from "../types";
import { nerpDashboardSchema } from "./schemas";

// O endpoint no nerp se chama `dashboard.list` (não `get`) e é GET. O
// retorno é o objeto plano de métricas — sem wrapper `{ dashboard }`.
//
// Importante: o handler declara `.input(z.object({}))` — exige *objeto vazio*,
// não undefined. Se passarmos `undefined`, o `_call.ts` omite `?data`,
// servidor recebe `undefined` e devolve 400 "Input validation failed".
export async function getDashboard(cfg: NerpOrgConfig) {
  const raw = await callNerpProcedure<unknown>(cfg, "dashboard.list", {}, {
    method: "GET",
  });
  return nerpDashboardSchema.parse(raw);
}
