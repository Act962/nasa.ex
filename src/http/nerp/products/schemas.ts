import { z } from "zod";

// Unidade do produto no nerp. Os valores aceitos vêm do enum `ProductUnit`
// (`prisma/schema.prisma` no nerp). Mantemos o conjunto que o nerp já aceita
// e deixamos o default em "UN".
export const nerpProductUnitSchema = z.enum([
  "UN",
  "KG",
  "G",
  "L",
  "ML",
  "M",
  "M2",
  "M3",
  "CM",
  "CX",
  "PCT",
  "DZ",
]);

// Produto retornado por `products.get`. É o shape "rico" — `products.list`
// usa um shape mais enxuto (ver `nerpProductListItemSchema`).
export const nerpProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  unit: nerpProductUnitSchema.optional(),
  salePrice: z.number().optional().nullable(),
  costPrice: z.number().optional().nullable(),
  promotionalPrice: z.number().optional().nullable(),
  currentStock: z.number().optional().nullable(),
  minStock: z.number().optional().nullable(),
  maxStock: z.number().optional().nullable(),
  images: z.array(z.string()).optional(),
  thumbnail: z.string().optional().nullable(),
  weight: z.number().optional().nullable(),
  length: z.number().optional().nullable(),
  width: z.number().optional().nullable(),
  height: z.number().optional().nullable(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  trackStock: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type NerpProduct = z.infer<typeof nerpProductSchema>;

// Linha enxuta retornada por `products.list`. Difere de `nerpProductSchema`:
// o nerp achata `category.name` em `category` e expõe `thumbnail` como
// `image`. Strings nullable são coagidas a "" no servidor.
export const nerpProductListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string().optional().default(""),
  barcode: z.string().optional().default(""),
  category: z.string().optional().default(""),
  salePrice: z.number(),
  costPrice: z.number(),
  currentStock: z.number(),
  minStock: z.number(),
  maxStock: z.number().optional().nullable(),
  image: z.string().optional().default(""),
  isActive: z.boolean(),
});

export type NerpProductListItem = z.infer<typeof nerpProductListItemSchema>;

export const nerpStockMovementSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  quantity: z.number(),
  notes: z.string().optional().nullable(),
  createdAt: z.union([z.string(), z.date()]).optional(),
  createdBy: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string().optional().nullable(),
      image: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
});

export const listProductsInputSchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
  sortBy: z.enum(["name", "createdAt", "salePrice", "currentStock"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

export const listProductsOutputSchema = z.object({
  products: z.array(nerpProductListItemSchema),
  page: z.number().int().optional(),
  pageSize: z.number().int().optional(),
  totalCount: z.number().int().optional(),
  totalPages: z.number().int().optional(),
  hasNextPage: z.boolean().optional(),
  hasPreviousPage: z.boolean().optional(),
});

export const getProductInputSchema = z.object({ id: z.string() });
export const getProductOutputSchema = z.object({
  product: nerpProductSchema,
  stockMovements: z.array(nerpStockMovementSchema).optional(),
});

// Input de criação. Required: `name`, `costPrice`, `salePrice` (espelha o
// schema do nerp em `src/app/router/products/create.ts`).
export const createProductInputSchema = z.object({
  name: z.string().min(1),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  unit: nerpProductUnitSchema.optional(),
  costPrice: z.number().nonnegative(),
  salePrice: z.number().nonnegative(),
  promotionalPrice: z.number().nonnegative().optional(),
  currentStock: z.number().nonnegative().optional(),
  minStock: z.number().nonnegative().optional(),
  maxStock: z.number().nonnegative().optional(),
  location: z.string().optional(),
  images: z.array(z.string()).optional(),
  thumbnail: z.string().optional(),
  weight: z.number().nonnegative().optional(),
  length: z.number().nonnegative().optional(),
  width: z.number().nonnegative().optional(),
  height: z.number().nonnegative().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  trackStock: z.boolean().optional(),
  allowNegative: z.boolean().optional(),
  showOnCatalog: z.boolean().optional(),
});

export const updateProductInputSchema = createProductInputSchema
  .partial()
  .extend({ id: z.string() });

// `duplicate` e `delete` no nerp usam `productId` como chave de entrada
// (não `id`). Manter aderência exata aqui evita 400 do servidor.
export const duplicateProductInputSchema = z.object({
  productId: z.string(),
});

export const deleteProductInputSchema = z.object({ productId: z.string() });

// Retornos compactos das mutations no nerp (sem `.output()` rígido, então
// modelamos como tolerante).
export const mutateProductOutputSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    slug: z.string().optional(),
    productId: z.string().optional(),
    productName: z.string().optional(),
  })
  .passthrough();
