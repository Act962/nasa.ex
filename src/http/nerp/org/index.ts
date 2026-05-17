import { callNerpProcedure } from "../_call";
import type { NerpOrgConfig } from "../types";
import { getNerpOrgOutputSchema, type NerpOrg } from "./schemas";

// Nerp expõe apenas `org.get`. Mutação genérica (`org.update`) não existe —
// existem `org.update-subdomain` e `org.check-subdomain` com semântica
// específica que NASA não consome no MVP.
export async function getNerpOrg(cfg: NerpOrgConfig): Promise<NerpOrg> {
  const raw = await callNerpProcedure<unknown>(cfg, "org.get");
  return getNerpOrgOutputSchema.parse(raw).org;
}
