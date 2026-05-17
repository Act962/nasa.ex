import { z } from "zod";

export const nerpCustomerSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  document: z.string().optional().nullable(),
  documentType: z.string().optional().nullable(),
  address: z.record(z.string(), z.unknown()).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  salesCount: z.number().int().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type NerpCustomer = z.infer<typeof nerpCustomerSchema>;

export const listCustomersInputSchema = z.object({
  search: z.string().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
});

export const listCustomersOutputSchema = z.object({
  customers: z.array(nerpCustomerSchema),
});

export const getCustomerInputSchema = z.object({ id: z.string() });
export const getCustomerOutputSchema = z.object({ customer: nerpCustomerSchema });

export const createCustomerInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  document: z.string().optional(),
  documentType: z.string().optional(),
  address: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateCustomerInputSchema = createCustomerInputSchema
  .partial()
  .extend({ id: z.string() });

export const deleteCustomerInputSchema = z.object({ id: z.string() });
