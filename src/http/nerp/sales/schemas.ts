import { z } from "zod";

// Enums espelhando `prisma/schema.prisma` do nerp.
export const nerpSaleStatusSchema = z.enum([
  "DRAFT",
  "CONFIRMED",
  "PROCESSING",
  "COMPLETED",
  "CANCELLED",
]);
export const nerpSalePaymentMethodSchema = z.enum([
  "DINHEIRO",
  "PIX",
  "DEBITO",
  "CREDITO",
  "BOLETO",
  "TRANSFERENCIA",
  "OUTROS",
]);

// Linha retornada por `sales.list`. Diferente do shape rico de `get` — só
// dados básicos + items resumidos.
export const nerpSaleListItemSchema = z.object({
  id: z.string(),
  saleNumber: z.number(),
  customer: z.string(),
  date: z.string(),
  status: z.string(),
  paymentMethod: z.string().nullable(),
  total: z.number(),
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      quantity: z.number(),
      price: z.number(),
    }),
  ),
});

export type NerpSaleListItem = z.infer<typeof nerpSaleListItemSchema>;

// Shape rico de `sales.get` — campos planos sem wrapper. Customer pode
// vir null (venda anônima).
export const nerpSaleSchema = z.object({
  id: z.string(),
  saleNumber: z.number(),
  status: nerpSaleStatusSchema,
  customer: z
    .object({
      name: z.string(),
      document: z.string().nullable(),
      address: z.string().nullable(),
      city: z.string().nullable(),
      state: z.string().nullable(),
    })
    .nullable()
    .optional(),
  items: z.array(
    z.object({
      id: z.string(),
      productName: z.string(),
      sku: z.string().nullable(),
      quantity: z.number(),
      unitPrice: z.number(),
      total: z.number(),
      categoryName: z.string().nullable().optional(),
    }),
  ),
  subtotal: z.number(),
  discount: z.number(),
  total: z.number(),
  icms: z.number().optional(),
  issuedAt: z.union([z.string(), z.date()]).optional(),
  authorizedAt: z.union([z.string(), z.date()]).optional(),
  cancelledAt: z.union([z.string(), z.date()]).optional(),
  cancellationReason: z.string().optional(),
  xmlUrl: z.string().optional(),
  createdAt: z.union([z.string(), z.date()]),
  pdfUrl: z.string().optional(),
});

export type NerpSale = z.infer<typeof nerpSaleSchema>;

// `sales.list` no nerp aceita filtros via input mas o handler atual ignora
// (devolve todas as vendas da org). Mantemos o schema pra forçar o tipo.
export const listSalesInputSchema = z.object({
  dateInit: z.coerce.date().optional(),
  dateEnd: z.coerce.date().optional(),
  methodPayment: z.string().optional(),
  status: z.string().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
});

export const listSalesOutputSchema = z.object({
  sales: z.array(nerpSaleListItemSchema),
});

// `sales.get` recebe `saleId` (não `id`).
export const getSaleInputSchema = z.object({ saleId: z.string() });

// `sales.create` no nerp exige `customerId?`, `subtotal`, `discount`, `total`,
// `status`, `paymentMethod` e `items[{productId, productName, unitPrice, quantity}]`.
// Retorna apenas `{ saleNumber }`.
export const createSaleItemInputSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  unitPrice: z.number().nonnegative(),
  quantity: z.number().positive(),
});

export const createSaleInputSchema = z.object({
  customerId: z.string().optional(),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  total: z.number().nonnegative(),
  status: nerpSaleStatusSchema,
  paymentMethod: nerpSalePaymentMethodSchema,
  items: z.array(createSaleItemInputSchema).min(1),
});

export const createSaleOutputSchema = z.object({
  saleNumber: z.number(),
});
