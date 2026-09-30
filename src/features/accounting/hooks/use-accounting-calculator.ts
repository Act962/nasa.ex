"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useCalculatorContext() {
  return useQuery(orpc.accounting.calculator.context.queryOptions({ input: {} }));
}

export function useRunCalculator() {
  return useMutation(orpc.accounting.calculator.run.mutationOptions());
}

export function useAccountingTaxRates(params: { tax?: "DAS" | "DAS_MEI" | "IRPJ" | "CSLL" | "PIS" | "COFINS" | "ISS" | "ICMS" | "CBS" | "IBS" | "IS" | "INSS" | "FGTS" | "IRRF"; enabled?: boolean } = {}) {
  return useQuery({
    ...orpc.accounting.rates.list.queryOptions({ input: params.tax ? { tax: params.tax } : {} }),
    enabled: params.enabled ?? true,
  });
}
