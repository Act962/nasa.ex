import { z } from "zod";

export const nerpCatalogSettingsSchema = z.object({
  id: z.string().optional(),
  organizationId: z.string().optional(),
  currency: z.string().optional(),
  defaultPriceListId: z.string().optional().nullable(),
  taxConfig: z.record(z.string(), z.unknown()).optional(),
  visibility: z.enum(["public", "private", "linked"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type NerpCatalogSettings = z.infer<typeof nerpCatalogSettingsSchema>;

export const listCatalogSettingsInputSchema = z.object({}).optional();
export const listCatalogSettingsOutputSchema = z.object({
  catalogSettings: nerpCatalogSettingsSchema,
});

export const updateCatalogSettingsInputSchema = nerpCatalogSettingsSchema.partial();
export const updateCatalogSettingsOutputSchema = z.object({
  catalogSettings: nerpCatalogSettingsSchema,
});
