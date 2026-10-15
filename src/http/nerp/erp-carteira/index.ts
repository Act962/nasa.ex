import { z } from "zod";
import { callNerpProcedure } from "../_call";
import type { NerpOrgConfig } from "../types";

// Spec 0106: página da carteira de clientes do Winthor (`erpCarteira.listar` no NERP, escopo `customer:rw`).

const erpOrderSchema = z.object({
  numero: z.string(),
  data: z.string(),
  valor: z.number(),
  filial: z.string().nullable(),
});

const erpCustomerSchema = z.object({
  codigo: z.string(),
  nome: z.string(),
  documento: z.string().nullable(),
  telefones: z.array(z.string()),
  email: z.string().nullable(),
  filial: z.object({ codigo: z.string(), nome: z.string() }).nullable(),
  consultor: z.object({ codigo: z.string(), nome: z.string() }).nullable(),
  clienteDesde: z.string().nullable(),
  primeiraCompra: z.string().nullable(),
  ultimaCompra: z.string().nullable(),
  valorUltimaCompra: z.number().nullable(),
  totalComprado: z.number(),
  quantidadeDePedidos: z.number(),
  divida: z
    .object({ valor: z.number(), parcelas: z.number(), vencimentoMaisAntigo: z.string() })
    .nullable(),
  interesses: z.array(z.string()),
  ultimosProdutos: z.array(z.string()),
  pedidos: z.array(erpOrderSchema),
});

const listErpCarteiraOutputSchema = z.object({
  clientes: z.array(erpCustomerSchema),
  proximoCursor: z.string().nullable(),
});

export type ErpCustomer = z.infer<typeof erpCustomerSchema>;
export type ErpCarteiraPage = z.infer<typeof listErpCarteiraOutputSchema>;

export async function listErpCarteira(
  cfg: NerpOrgConfig,
  input: { cursor: string | null; desde: string | null; limite: number },
): Promise<ErpCarteiraPage> {
  const raw = await callNerpProcedure<unknown>(cfg, "erpCarteira.listar", input, {
    timeoutMs: 90_000,
  });
  return listErpCarteiraOutputSchema.parse(raw);
}
