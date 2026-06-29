import { z } from "zod";

// Enums de `prisma/schema.prisma` no nerp.
export const nerpCatalogSortOrderSchema = z.enum([
  "ASC",
  "DESC",
  "NEWEST",
  "OLDEST",
]);
export const nerpDeliveryMethodSchema = z.enum([
  "DELIVERY_HOME",
  "PICKUP_STORE",
  "ROOM_SERVICE",
  "DIGITAL_DELIVERY",
]);
export const nerpFreightOptionSchema = z.enum([
  "NEGOTIATE_WHATSAPP",
  "NEGOTIATE_FREIGHT",
  "FREE_SHIPPING",
  "NO_SHIPPING",
]);
export const nerpFreightChargeTypeSchema = z.enum(["FIXED", "PER_KG"]);
export const nerpPaymentMethodSchema = z.enum([
  "DINHEIRO",
  "PIX",
  "DEBITO",
  "CREDITO",
  "BOLETO",
  "TRANSFERENCIA",
  "OUTROS",
]);

// Shape real retornado por `catalogSettings.list` no nerp (upsert do registro
// único da org, com valores monetários já coagidos para Number). Mantemos
// `passthrough` porque o nerp espalha `...catalogSettings` no spread inicial.
export const nerpCatalogSettingsSchema = z
  .object({
    id: z.string(),
    organizationId: z.string(),
    isActive: z.boolean().optional(),
    showPrices: z.boolean().optional(),
    showProductWithoutStock: z.boolean().optional(),
    showStock: z.boolean().optional(),
    allowOrders: z.boolean().optional(),
    sortOrder: nerpCatalogSortOrderSchema.optional(),
    whatsappNumber: z.string().optional().nullable(),
    showWhatsapp: z.boolean().optional(),
    contactEmail: z.string().optional().nullable(),
    cep: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    district: z.string().optional().nullable(),
    number: z.string().optional().nullable(),
    metaTitle: z.string().optional().nullable(),
    metaDescription: z.string().optional().nullable(),
    cnpj: z.string().optional().nullable(),
    logo: z.string().optional().nullable(),
    bannerImages: z.array(z.string()).optional(),
    aboutText: z.string().optional().nullable(),
    theme: z.string().optional().nullable(),
    paymentMethodSettings: z.array(nerpPaymentMethodSchema).optional(),
    deliveryMethods: z.array(nerpDeliveryMethodSchema).optional(),
    deliverySpecialInfo: z.string().optional().nullable(),
    freightOptions: nerpFreightOptionSchema.optional(),
    freightChargeType: nerpFreightChargeTypeSchema.optional(),
    freightFixedValue: z.number().optional(),
    freightValuePerKg: z.number().optional(),
    freeShippingEnabled: z.boolean().optional(),
    freeShippingMinValue: z.number().optional(),
    id_meta: z.string().optional().nullable(),
    pixel_meta: z.string().optional().nullable(),
    stripeKey: z.string().optional().nullable(),
    walletId: z.string().optional().nullable(),
    instagram: z.string().optional().nullable(),
    facebook: z.string().optional().nullable(),
    twitter: z.string().optional().nullable(),
    youtube: z.string().optional().nullable(),
    kwai: z.string().optional().nullable(),
    tiktok: z.string().optional().nullable(),
    createdAt: z.union([z.string(), z.date()]).optional(),
    updatedAt: z.union([z.string(), z.date()]).optional(),
  })
  .passthrough();

export type NerpCatalogSettings = z.infer<typeof nerpCatalogSettingsSchema>;

export const listCatalogSettingsInputSchema = z.object({}).optional();
export const listCatalogSettingsOutputSchema = z.object({
  catalogSettings: nerpCatalogSettingsSchema,
});

// `catalogSettings.update` no nerp recebe `id` (obrigatório) + qualquer
// subset dos demais campos do CatalogSettings. Não tem retorno tipado
// (`.output()` ausente) — o handler retorna undefined em sucesso.
export const updateCatalogSettingsInputSchema = z.object({
  id: z.string(),
  isActive: z.boolean().optional(),
  showPrices: z.boolean().optional(),
  showStock: z.boolean().optional(),
  showProductWithoutStock: z.boolean().optional(),
  sortOrder: nerpCatalogSortOrderSchema.optional(),
  allowOrders: z.boolean().optional(),
  whatsappNumber: z.string().optional(),
  showWhatsapp: z.boolean().optional(),
  contactEmail: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  logo: z.string().optional(),
  bannerImages: z.array(z.string()).optional(),
  aboutText: z.string().optional(),
  theme: z.string().optional(),
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  twitter: z.string().optional(),
  tiktok: z.string().optional(),
  youtube: z.string().optional(),
  kwai: z.string().optional(),
  cep: z.string().optional(),
  address: z.string().optional(),
  district: z.string().optional(),
  number: z.string().optional(),
  id_meta: z.string().optional(),
  pixel_meta: z.string().optional(),
  paymentMethodSettings: z.array(nerpPaymentMethodSchema).optional(),
  deliveryMethods: z.array(nerpDeliveryMethodSchema).optional(),
  freightOptions: nerpFreightOptionSchema.optional(),
  freightChargeType: nerpFreightChargeTypeSchema.optional(),
  freightFixedValue: z.number().optional(),
  freightValuePerKg: z.number().optional(),
  freeShippingEnabled: z.boolean().optional(),
  freeShippingMinValue: z.number().optional(),
  cnpj: z.string().optional(),
  deliverySpecialInfo: z.string().optional(),
  walletId: z.string().optional(),
});
