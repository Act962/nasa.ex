"use client";

import { create } from "zustand";

/**
 * Filtros do cabeçalho de /contatos, compartilhados com a tabela.
 *
 * Zustand porque cabeçalho e tabela são irmãos na página: sem estado comum,
 * clicar num card mudaria só o número e a lista abaixo continuaria a mesma —
 * o painel diria uma coisa e a tabela outra.
 */

export type LeadSegment = "novos" | "campeoes" | "leais" | "risco";
export type LeadDateField = "createdAt" | "lastInboundAt";

interface ContactsFiltersState {
  trackingId?: string;
  tagIds: string[];
  dateField: LeadDateField;
  from?: Date;
  to?: Date;
  /** Card selecionado. `undefined` = Total, que é o estado sem recorte. */
  segment?: LeadSegment;
  setTrackingId: (id?: string) => void;
  setTagIds: (ids: string[]) => void;
  setDateField: (field: LeadDateField) => void;
  setRange: (range: { from?: Date; to?: Date }) => void;
  toggleSegment: (segment?: LeadSegment) => void;
}

export const useContactsFilters = create<ContactsFiltersState>((set) => ({
  tagIds: [],
  dateField: "createdAt",
  setTrackingId: (trackingId) => set({ trackingId }),
  setTagIds: (tagIds) => set({ tagIds }),
  setDateField: (dateField) => set({ dateField }),
  setRange: (range) => set({ from: range.from, to: range.to }),
  // Clicar no card já selecionado volta ao Total — é o gesto que todo
  // filtro de cartão tem, e sem ele o usuário fica preso no recorte.
  toggleSegment: (segment) =>
    set((state) => ({ segment: state.segment === segment ? undefined : segment })),
}));
