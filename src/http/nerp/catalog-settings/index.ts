import { z } from "zod";
import { callNerpProcedure } from "../_call";
import type { NerpOrgConfig } from "../types";
import {
  listCatalogSettingsOutputSchema,
  updateCatalogSettingsOutputSchema,
  updateCatalogSettingsInputSchema,
} from "./schemas";

export type UpdateCatalogSettingsInput = z.infer<typeof updateCatalogSettingsInputSchema>;

// Nerp expõe `catalogSettings.list` (não `get`). Retorna o objeto único da org.
export async function listCatalogSettings(cfg: NerpOrgConfig) {
  const raw = await callNerpProcedure<unknown>(cfg, "catalogSettings.list");
  return listCatalogSettingsOutputSchema.parse(raw).catalogSettings;
}

export async function updateCatalogSettings(
  cfg: NerpOrgConfig,
  input: UpdateCatalogSettingsInput,
) {
  const raw = await callNerpProcedure<unknown>(
    cfg,
    "catalogSettings.update",
    input,
  );
  return updateCatalogSettingsOutputSchema.parse(raw).catalogSettings;
}
