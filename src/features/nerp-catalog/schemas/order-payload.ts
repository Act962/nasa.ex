import { z } from "zod";

// Contrato do POST /api/integrations/nerp/orders — espelha o payload montado
// pelo NERP em `features/orbita-orders`. Mudou aqui, mude lá.

export const catalogOrderItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  sku: z.string().nullable(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  total: z.number().nonnegative(),
  imageUrl: z.string().nullable(),
});

export const catalogOrderCustomerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(8),
  email: z.string().nullable(),
  document: z.string().nullable(),
});

export const catalogOrderDeliverySchema = z.object({
  method: z.string().nullable(),
  address: z.string().nullable(),
  notes: z.string().nullable(),
});

export const nerpCatalogOrderPayloadSchema = z.object({
  nerpSaleId: z.string().min(1),
  saleNumber: z.number().int(),
  createdAt: z.string(),
  customer: catalogOrderCustomerSchema,
  delivery: catalogOrderDeliverySchema,
  items: z.array(catalogOrderItemSchema).min(1),
  subtotal: z.number().nonnegative(),
  shipping: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  total: z.number().nonnegative(),
  catalogUrl: z.string().nullable(),
});

export type NerpCatalogOrderPayload = z.infer<typeof nerpCatalogOrderPayloadSchema>;
export type CatalogOrderItem = z.infer<typeof catalogOrderItemSchema>;
export type CatalogOrderCustomer = z.infer<typeof catalogOrderCustomerSchema>;
export type CatalogOrderDelivery = z.infer<typeof catalogOrderDeliverySchema>;

export type NerpCatalogOrderResponse = {
  orderToken: string;
  portalUrl: string;
  whatsappUrl: string | null;
};
