"use client";

import { useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Invalidação padrão da aba Contábil (e do financeiro, que ela alimenta). */
export function useInvalidateAccounting() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.accounting.key() });
    queryClient.invalidateQueries({ queryKey: orpc.payment.key() });
  };
}
