"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useInvalidateAccounting } from "./use-accounting-invalidation";

type CreditStatusFilter = "PENDING_PAYMENT" | "AVAILABLE" | "USED" | "GLOSSED";

export function useCreditSummary(months = 6) {
  return useQuery(orpc.accounting.credits.summary.queryOptions({ input: { months } }));
}

export function useCreditList(params: { status?: CreditStatusFilter; month?: string } = {}) {
  return useQuery(
    orpc.accounting.credits.list.queryOptions({ input: { status: params.status, month: params.month, limit: 200 } }),
  );
}

export function useSupplierCreditRanking() {
  return useQuery(orpc.accounting.credits.supplierRanking.queryOptions({ input: {} }));
}

export function useMissingInvoices() {
  return useQuery(orpc.accounting.credits.missingInvoices.queryOptions({ input: {} }));
}

export function useRegisterCreditFromAttachment() {
  const invalidateAccounting = useInvalidateAccounting();
  return useMutation({ ...orpc.accounting.credits.registerFromAttachment.mutationOptions(), onSuccess: invalidateAccounting });
}

export function useSetSupplierRegime() {
  const invalidateAccounting = useInvalidateAccounting();
  return useMutation({ ...orpc.accounting.credits.setSupplierRegime.mutationOptions(), onSuccess: invalidateAccounting });
}

export function useReprocessCredits() {
  const invalidateAccounting = useInvalidateAccounting();
  return useMutation({ ...orpc.accounting.credits.reprocess.mutationOptions(), onSuccess: invalidateAccounting });
}
