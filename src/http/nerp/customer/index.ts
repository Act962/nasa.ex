import { z } from "zod";
import { callNerpProcedure } from "../_call";
import type { NerpOrgConfig } from "../types";
import {
  listCustomersInputSchema,
  listCustomersOutputSchema,
  getCustomerInputSchema,
  getCustomerOutputSchema,
  createCustomerInputSchema,
  createCustomerOutputSchema,
  updateCustomerInputSchema,
  updateCustomerOutputSchema,
  deleteCustomerInputSchema,
} from "./schemas";

export type ListCustomersInput = z.infer<typeof listCustomersInputSchema>;
export type GetCustomerInput = z.infer<typeof getCustomerInputSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerInputSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerInputSchema>;
export type DeleteCustomerInput = z.infer<typeof deleteCustomerInputSchema>;

// `customer.getOne` (singular `getOne` no router do nerp — não `get`).
// `customer.list`/`getOne` são POST (default); `create`/`update`/`delete`
// também POST (nenhum `route({ method })` declarado nesses handlers).
export async function listCustomers(cfg: NerpOrgConfig, input: ListCustomersInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "customer.list", input);
  return listCustomersOutputSchema.parse(raw);
}
export async function getCustomer(cfg: NerpOrgConfig, input: GetCustomerInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "customer.getOne", input);
  return getCustomerOutputSchema.parse(raw).customer;
}
export async function createCustomer(cfg: NerpOrgConfig, input: CreateCustomerInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "customer.create", input);
  return createCustomerOutputSchema.parse(raw);
}
export async function updateCustomer(cfg: NerpOrgConfig, input: UpdateCustomerInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "customer.update", input);
  return updateCustomerOutputSchema.parse(raw).customer;
}
export async function deleteCustomer(cfg: NerpOrgConfig, input: DeleteCustomerInput) {
  return callNerpProcedure<unknown>(cfg, "customer.delete", input);
}
