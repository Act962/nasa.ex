"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Saldo atual de Stars da org. */
export function useStarsBalance() {
  return useQuery(orpc.stars.getBalance.queryOptions());
}

/** Config de preço (R$/★, mínimo, presets) pro modal de compra. */
export function useStarsPricing() {
  return useQuery(orpc.stars.getStarsPricing.queryOptions());
}

/** Cria a Stripe Checkout Session de recarga. Sem invalidação — faz redirect. */
export function useCreateStarsCheckout() {
  return useMutation(orpc.stars.createStarsCheckout.mutationOptions());
}
