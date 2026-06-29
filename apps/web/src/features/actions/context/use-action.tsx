import { create } from "zustand";

interface ActionStore {
  selectedIds: string[];
  toggleAction: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
}

export const useActionStore = create<ActionStore>((set, get) => ({
  selectedIds: [],
  toggleAction: (id: string) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((item) => item !== id)
        : [...state.selectedIds, id],
    })),
  selectAll: (ids: string[]) => set({ selectedIds: ids }),
  clearSelection: () => set({ selectedIds: [] }),
  isSelected: (id: string) => get().selectedIds.includes(id),
}));
