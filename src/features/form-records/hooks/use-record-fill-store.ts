"use client";

import { create } from "zustand";

/**
 * Valores que uma "Busca no Órbita" trouxe de outra ficha, por nome-chave
 * (spec 0075, RF-7). Os campos de mesmo nome-chave acompanham enquanto o
 * usuário não os editar à mão — a mesma regra do prefill da spec 0006.
 */
interface RecordFillStore {
  valuesByKey: Record<string, string>;
  fill: (values: Record<string, string>) => void;
  clear: () => void;
}

export const useRecordFillStore = create<RecordFillStore>()((set) => ({
  valuesByKey: {},
  fill: (values) => set((state) => ({ valuesByKey: { ...state.valuesByKey, ...values } })),
  clear: () => set({ valuesByKey: {} }),
}));

export function useRecordFillValue(fieldKey: string | null | undefined): string | undefined {
  return useRecordFillStore((state) => (fieldKey ? state.valuesByKey[fieldKey] : undefined));
}
