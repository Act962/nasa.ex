import { z } from "zod";
import { callNerpProcedure } from "../_call";
import type { NerpOrgConfig } from "../types";
import {
  listCatalogSettingsOutputSchema,
  updateCatalogSettingsInputSchema,
} from "./schemas";

export type UpdateCatalogSettingsInput = z.infer<typeof updateCatalogSettingsInputSchema>;

// `catalogSettings.list` no nerp é GET sem input (faz upsert e devolve o
// registro único da org). `catalogSettings.update` é PUT (path
// `/settings-catalog/:id`) e não declara `.output()` — handler retorna
// undefined em sucesso, então usamos `unknown`.
export async function listCatalogSettings(cfg: NerpOrgConfig) {
  const raw = await callNerpProcedure<unknown>(cfg, "catalogSettings.list", undefined, {
    method: "GET",
  });
  return listCatalogSettingsOutputSchema.parse(raw).catalogSettings;
}

export async function updateCatalogSettings(
  cfg: NerpOrgConfig,
  input: UpdateCatalogSettingsInput,
) {
  await callNerpProcedure<unknown>(cfg, "catalogSettings.update", input, {
    method: "PUT",
  });
  return { ok: true } as const;
}
