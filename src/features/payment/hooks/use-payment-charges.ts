"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Link é calculado sob demanda (ao abrir o diálogo), por isso mutation e não query. */
export function usePaymentChargeLink() {
  return useMutation(orpc.payment.charges.getLink.mutationOptions());
}

type ListChargesInput = Parameters<typeof orpc.payment.charges.list.queryOptions>[0]["input"];

export function usePaymentCharges(input: ListChargesInput) {
  return useQuery({
    ...orpc.payment.charges.list.queryOptions({ input }),
    placeholderData: keepPreviousData,
  });
}
