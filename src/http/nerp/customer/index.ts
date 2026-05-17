import { z } from "zod";
import { callNerpProcedure } from "../_call";
import type { NerpOrgConfig } from "../types";
import {
  listCustomersInputSchema,
  listCustomersOutputSchema,
  getCustomerInputSchema,
  getCustomerOutputSchema,
  createCustomerInputSchema,
  updateCustomerInputSchema,
  deleteCustomerInputSchema,
  nerpCustomerSchema,
} from "./schemas";

export type ListCustomersInput = z.infer<typeof listCustomersInputSchema>;
export type GetCustomerInput = z.infer<typeof getCustomerInputSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerInputSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerInputSchema>;
export type DeleteCustomerInput = z.infer<typeof deleteCustomerInputSchema>;

export async function listCustomers(cfg: NerpOrgConfig, input: ListCustomersInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "customer.list", input);
  return listCustomersOutputSchema.parse(raw);
}
export async function getCustomer(cfg: NerpOrgConfig, input: GetCustomerInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "customer.get", input);
  return getCustomerOutputSchema.parse(raw).customer;
}
export async function createCustomer(cfg: NerpOrgConfig, input: CreateCustomerInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "customer.create", input);
  return z.object({ customer: nerpCustomerSchema }).parse(raw).customer;
}
export async function updateCustomer(cfg: NerpOrgConfig, input: UpdateCustomerInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "customer.update", input);
  return z.object({ customer: nerpCustomerSchema }).parse(raw).customer;
}
export async function deleteCustomer(cfg: NerpOrgConfig, input: DeleteCustomerInput) {
  return callNerpProcedure<unknown>(cfg, "customer.delete", input);
}
