import { z } from "zod";

// `MovementType` enum no `prisma/schema.prisma` do nerp.
export const nerpMovementTypeSchema = z.enum([
  "ENTRADA",
  "SAIDA",
  "VENDA",
  "COMPRA",
  "DEVOLUCAO",
  "AJUSTE",
  "TRANSFERENCIA",
  "PERDA",
]);

// Item retornado por `stocks.list` no nerp.
export const nerpStockMovementSchema = z.object({
  id: z.string(),
  createdAt: z.union([z.string(), z.date()]),
  type: nerpMovementTypeSchema,
  quantity: z.number(),
  previousStock: z.number(),
  newStock: z.number(),
  notes: z.string().nullable(),
  product: z.object({
    id: z.string(),
    name: z.string(),
    sku: z.string().nullable(),
  }),
  user: z.object({
    id: z.string(),
    name: z.string(),
  }),
});

export type NerpStockMovement = z.infer<typeof nerpStockMovementSchema>;

// `stocks.list` no nerp recebe `name?`, paginação `offset/limit`, filtros por
// `userIds`/`dateInit`/`dateEnd`. O handler usa `(offset - 1) * limit` na
// paginação — paginação 1-based no nerp. O caller (`http/nerp/stocks`)
// força offset >= 1 antes de chamar.
export const listStocksInputSchema = z.object({
  name: z.string().optional(),
  offset: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  userIds: z.array(z.string()).optional(),
  dateInit: z.coerce.date().optional(),
  dateEnd: z.coerce.date().optional(),
});

// O servidor devolve `moviments` (typo). Mantemos a chave igual à do nerp.
export const listStocksOutputSchema = z.object({
  moviments: z.array(nerpStockMovementSchema),
});
