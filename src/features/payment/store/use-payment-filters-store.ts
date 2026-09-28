"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PeriodRange } from "../components/shared/payment-period-picker";

// Filtros do módulo financeiro, um só para todas as abas.
//
// Antes cada aba tinha o próprio `useState` de período: trocar de Despesa para
// Fluxo de Caixa reiniciava o filtro no mês corrente, e a mesma pergunta em
// duas telas dava respostas de períodos diferentes.
//
// As datas são guardadas como ISO string, não Date: o `persist` serializa em
// JSON, e um Date volta do localStorage como string — o componente quebraria
// ao chamar `.getTime()` num "2026-09-01T...". A conversão fica concentrada
// aqui, nos seletores.

interface StoredPeriod {
  from?: string;
  to?: string;
}

interface PaymentFiltersState {
  period: StoredPeriod;
  categoryIds: string[];

  setPeriod: (range: PeriodRange) => void;
  setCategoryIds: (categoryIds: string[]) => void;
  toggleCategory: (categoryId: string) => void;
  clearCategories: () => void;
  resetToCurrentMonth: () => void;
}

function currentMonthStored(): StoredPeriod {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString(),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString(),
  };
}

export const usePaymentFiltersStore = create<PaymentFiltersState>()(
  persist(
    (set) => ({
      period: currentMonthStored(),
      categoryIds: [],

      setPeriod: (range) =>
        set({
          period: {
            from: range.from?.toISOString(),
            to: range.to?.toISOString(),
          },
        }),

      setCategoryIds: (categoryIds) => set({ categoryIds }),

      toggleCategory: (categoryId) =>
        set((state) => ({
          categoryIds: state.categoryIds.includes(categoryId)
            ? state.categoryIds.filter((id) => id !== categoryId)
            : [...state.categoryIds, categoryId],
        })),

      clearCategories: () => set({ categoryIds: [] }),

      resetToCurrentMonth: () => set({ period: currentMonthStored() }),
    }),
    {
      name: "nasa-payment-filters",
      version: 1,
    },
  ),
);

/** Período como `Date`, que é o formato que o picker e os gráficos esperam. */
export function usePaymentPeriod(): PeriodRange {
  const period = usePaymentFiltersStore((state) => state.period);
  return {
    from: period.from ? new Date(period.from) : undefined,
    to: period.to ? new Date(period.to) : undefined,
  };
}

/** Período em ISO, que é o formato que as procedures esperam. */
export function usePaymentPeriodIso(): { dateFrom?: string; dateTo?: string } {
  const period = usePaymentFiltersStore((state) => state.period);
  return { dateFrom: period.from, dateTo: period.to };
}

/**
 * Lista vazia significa "todas as categorias" e é enviada como `undefined`
 * para não virar um `IN ()` que não devolve nada.
 */
export function usePaymentCategoryFilter(): string[] | undefined {
  const categoryIds = usePaymentFiltersStore((state) => state.categoryIds);
  return categoryIds.length > 0 ? categoryIds : undefined;
}
