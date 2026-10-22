"use client";

import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Link é calculado sob demanda (ao abrir o diálogo), por isso mutation e não query. */
export function usePaymentChargeLink() {
  return useMutation(orpc.payment.charges.getLink.mutationOptions());
}
