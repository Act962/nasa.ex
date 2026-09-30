"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useInvalidateAccounting } from "./use-accounting-invalidation";

type ProductTaxKind = "PRODUCT" | "SERVICE";

/** Classificações e preços também aparecem no Forge: invalida os dois lados. */
function useInvalidatePricing() {
  const queryClient = useQueryClient();
  const invalidateAccounting = useInvalidateAccounting();
  return () => {
    invalidateAccounting();
    queryClient.invalidateQueries({ queryKey: orpc.forge.products.key() });
  };
}

/**
 * Lista de classificações. `silent` é para telas fora do financeiro (Forge):
 * quem não tem acesso ao Payment recebe FORBIDDEN e a tela segue sem o campo.
 */
export function useTaxClassifications(options: { enabled?: boolean; silent?: boolean } = {}) {
  return useQuery({
    ...orpc.accounting.pricing.classifications.list.queryOptions({ input: {} }),
    enabled: options.enabled ?? true,
    retry: options.silent ? false : undefined,
  });
}

export function useCreateTaxClassification() {
  const invalidatePricing = useInvalidatePricing();
  return useMutation({ ...orpc.accounting.pricing.classifications.create.mutationOptions(), onSuccess: invalidatePricing });
}

export function useUpdateTaxClassification() {
  const invalidatePricing = useInvalidatePricing();
  return useMutation({ ...orpc.accounting.pricing.classifications.update.mutationOptions(), onSuccess: invalidatePricing });
}

export function useDeleteTaxClassification() {
  const invalidatePricing = useInvalidatePricing();
  return useMutation({ ...orpc.accounting.pricing.classifications.delete.mutationOptions(), onSuccess: invalidatePricing });
}

export function useAssignProductClassification() {
  const invalidatePricing = useInvalidatePricing();
  return useMutation({ ...orpc.accounting.pricing.assignToProduct.mutationOptions(), onSuccess: invalidatePricing });
}

export function useApplySuggestedPrice() {
  const invalidatePricing = useInvalidatePricing();
  return useMutation({ ...orpc.accounting.pricing.applyPrice.mutationOptions(), onSuccess: invalidatePricing });
}

export function usePricingDiagnostics() {
  return useQuery(orpc.accounting.pricing.diagnostics.queryOptions({ input: {} }));
}

/**
 * Alíquota efetiva do perfil fiscal. Com `silent`, não tenta de novo em erro
 * (ex.: FORBIDDEN de quem não acessa o financeiro) — o chamador cai no manual.
 */
export function useEffectiveTaxRate(
  params: { kind: ProductTaxKind; reductionBps?: number; issRateBpsOverride?: number | null },
  options: { enabled?: boolean; silent?: boolean } = {},
) {
  return useQuery({
    ...orpc.accounting.pricing.effectiveRate.queryOptions({ input: params }),
    enabled: options.enabled ?? true,
    retry: options.silent ? false : undefined,
    staleTime: 5 * 60 * 1000,
  });
}
