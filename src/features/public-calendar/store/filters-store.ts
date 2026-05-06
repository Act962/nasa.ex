"use client";

import { create } from "zustand";
import type { EventCategory } from "@/generated/prisma/enums";

export type CalendarView = "month" | "list";

interface FiltersState {
  country: string | null;
  state: string | null;
  city: string | null;
  category: EventCategory | null;
  organizationId: string | null;
  search: string;
  from: Date | null;
  to: Date | null;
  view: CalendarView;
  setCountry: (country: string | null) => void;
  setState: (state: string | null) => void;
  setCity: (city: string | null) => void;
  setCategory: (category: EventCategory | null) => void;
  setOrganizationId: (organizationId: string | null) => void;
  setSearch: (search: string) => void;
  setFrom: (from: Date | null) => void;
  setTo: (to: Date | null) => void;
  setView: (view: CalendarView) => void;
  reset: () => void;
}

export const useFiltersStore = create<FiltersState>((set) => ({
  country: "BR",
  state: null,
  city: null,
  category: null,
  organizationId: null,
  search: "",
  from: null,
  to: null,
  view: "month",
  setCountry: (country) => set({ country }),
  setState: (state) => set({ state, city: null }),
  setCity: (city) => set({ city }),
  setCategory: (category) => set({ category }),
  setOrganizationId: (organizationId) => set({ organizationId }),
  setSearch: (search) => set({ search }),
  setFrom: (from) => set({ from }),
  setTo: (to) => set({ to }),
  setView: (view) => set({ view }),
  reset: () =>
    set({
      state: null,
      city: null,
      category: null,
      organizationId: null,
      search: "",
      from: null,
      to: null,
    }),
}));
