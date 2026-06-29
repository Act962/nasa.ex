"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

// `sales.list` no nerp aceita filtros (data, status, método de pagamento,
// faixa de valor) — note que o handler atual no nerp ignora boa parte
// deles, mas mantemos o contrato pra estar pronto pra v2.
export function useNerpSales(input?: {
  dateInit?: Date;
  dateEnd?: Date;
  methodPayment?: string;
  status?: string;
  minValue?: number;
  maxValue?: number;
}) {
  return useQuery(orpc.nerp.sales.list.queryOptions({ input: input ?? {} }));
}

// `sales.get` no nerp usa `saleId` (não `id`).
export function useNerpSale(saleId: string, enabled = true) {
  return useQuery({
    ...orpc.nerp.sales.get.queryOptions({ input: { saleId } }),
    enabled: Boolean(saleId) && enabled,
  });
}

export function useCreateNerpSale() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nerp.sales.create.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: ["nerp"] }),
    }),
  );
}
