import { z } from "zod";

// `PersonType` enum no nerp (`prisma/schema.prisma`).
export const nerpPersonTypeSchema = z.enum(["FISICA", "JURIDICA"]);

// Customer cru retornado por `customer.getOne`/`update` — vem direto do
// Prisma. `customer.list` traz o mesmo objeto + `sales: Sale[]`.
export const nerpCustomerSchema = z
  .object({
    id: z.string(),
    organizationId: z.string().optional(),
    name: z.string(),
    personType: nerpPersonTypeSchema.optional(),
    document: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    addressNumber: z.string().optional().nullable(),
    complement: z.string().optional().nullable(),
    neighborhood: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    zipCode: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
    asaasCustomerId: z.string().optional().nullable(),
    createdAt: z.union([z.string(), z.date()]).optional(),
    updatedAt: z.union([z.string(), z.date()]).optional(),
  })
  .passthrough();

export type NerpCustomer = z.infer<typeof nerpCustomerSchema>;

const nerpCustomerSaleSummarySchema = z
  .object({
    id: z.string(),
    saleNumber: z.number().optional(),
    total: z.union([z.number(), z.string()]).optional(),
    status: z.string().optional(),
    createdAt: z.union([z.string(), z.date()]).optional(),
  })
  .passthrough();

export const nerpCustomerWithSalesSchema = nerpCustomerSchema.extend({
  sales: z.array(nerpCustomerSaleSummarySchema).optional().default([]),
});

export type NerpCustomerWithSales = z.infer<typeof nerpCustomerWithSalesSchema>;

// `customer.list` aceita filtros de tipo, faixa de compra e datas.
export const listCustomersInputSchema = z.object({
  personType: nerpPersonTypeSchema.optional(),
  minPurchase: z.number().optional(),
  maxPurchase: z.number().optional(),
  dateIni: z.coerce.date().optional(),
  dateEnd: z.coerce.date().optional(),
});

export const listCustomersOutputSchema = z.object({
  customers: z.array(nerpCustomerWithSalesSchema),
});

export const getCustomerInputSchema = z.object({ id: z.string() });
export const getCustomerOutputSchema = z.object({ customer: nerpCustomerSchema });

// `customer.create` no nerp:
//  - `name` e `email` obrigatórios
//  - `type` no payload (não `personType`) — handler renomeia internamente
//  - `cep`/`description` no payload (não `zipCode`/`notes`)
//  - retorna apenas `{ id, name }`
export const createCustomerInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  type: nerpPersonTypeSchema,
  document: z.string().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  cep: z.string().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
});

export const createCustomerOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
});

// `customer.update` recebe `Prisma.CustomerUpdateInput` direto. Expomos só
// os campos que o handler de fato copia para o `prisma.customer.update`.
export const updateCustomerInputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  document: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  personType: nerpPersonTypeSchema.optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export const updateCustomerOutputSchema = z.object({
  customer: nerpCustomerSchema,
});

export const deleteCustomerInputSchema = z.object({ id: z.string() });
