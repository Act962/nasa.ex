import { z } from "zod";
import { callNerpProcedure } from "../_call";
import type { NerpOrgConfig } from "../types";
import {
  checkSubdomainInputSchema,
  checkSubdomainOutputSchema,
  getNerpOrgOutputSchema,
  updateSubdomainInputSchema,
  updateSubdomainOutputSchema,
  type NerpOrg,
} from "./schemas";

export type CheckNerpSubdomainInput = z.infer<typeof checkSubdomainInputSchema>;
export type UpdateNerpSubdomainInput = z.infer<typeof updateSubdomainInputSchema>;

// `org.get` é declarado no nerp como `.route({ method: "GET" })` com
// `z.void()` no input — vai sem payload e como GET.
export async function getNerpOrg(cfg: NerpOrgConfig): Promise<NerpOrg> {
  const raw = await callNerpProcedure<unknown>(cfg, "org.get", undefined, {
    method: "GET",
  });
  return getNerpOrgOutputSchema.parse(raw).organization;
}

// `org.checkSubdomain` é GET no nerp (`.route({ method: "GET" })`).
export async function checkNerpSubdomain(
  cfg: NerpOrgConfig,
  input: CheckNerpSubdomainInput,
) {
  const raw = await callNerpProcedure<unknown>(cfg, "org.checkSubdomain", input, {
    method: "GET",
  });
  return checkSubdomainOutputSchema.parse(raw);
}

// `org.updateSubdomain` é POST no nerp.
export async function updateNerpSubdomain(
  cfg: NerpOrgConfig,
  input: UpdateNerpSubdomainInput,
) {
  const raw = await callNerpProcedure<unknown>(cfg, "org.updateSubdomain", input);
  return updateSubdomainOutputSchema.parse(raw);
}
