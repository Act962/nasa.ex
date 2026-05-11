"use client";

import { create } from "zustand";
import { FormBlockInstance, FormWithSettings } from "../types";
import { v4 as uuidv4 } from "uuid";
import { client } from "@/lib/orpc";
import { FormSettings } from "@/generated/prisma/client";

type HistorySnapshot = {
  blockLayouts: FormBlockInstance[];
  settings: FormWithSettings["settings"] | null;
};

type BuilderState = {
  loading: boolean;
  formData: FormWithSettings | null;
  blockLayouts: FormBlockInstance[];
  selectedBlockLayout: FormBlockInstance | null;
  selectedChildId: string | null;
  history: HistorySnapshot[];
  historyIndex: number;
  isApplyingHistory: boolean;
};

type BuilderActions = {
  setFormData: (formData: FormWithSettings | null) => void;
  setBlockLayouts: (
    blockLayouts:
      | FormBlockInstance[]
      | ((prev: FormBlockInstance[]) => FormBlockInstance[]),
  ) => void;

  fetchFormById: (formId: string) => Promise<void>;

  addBlockLayout: (blockLayout: FormBlockInstance) => void;
  removeBlockLayout: (id: string) => void;
  duplicateBlockLayout: (id: string) => void;

  handleSelectedLayout: (blockLayout: FormBlockInstance | null) => void;
  setSelectedChildId: (id: string | null) => void;

  updateBlockLayout: (id: string, childrenBlocks: FormBlockInstance[]) => void;

  updateAnyBlock: (
    id: string,
    updatedBlock: FormBlockInstance,
    parentId?: string,
  ) => void;

  repositionBlockLayout: (
    activeId: string,
    overId: string,
    position: "above" | "below",
  ) => void;

  insertBlockLayoutAtIndex: (
    overId: string,
    newBlockLayout: FormBlockInstance,
    position: "above" | "below",
  ) => void;

  updateChildBlock: (
    parentId: string,
    childblockId: string,
    updatedBlock: FormBlockInstance,
  ) => void;

  updateSettings: (updates: Partial<FormSettings>) => void;

  // ─── Histórico (undo/redo) ─────────────────────────────────────────────
  pushHistorySnapshot: () => void;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
};

export type BuilderStore = BuilderState & BuilderActions;

export const useBuilderStore = create<BuilderStore>((set, get) => ({
  // ─── State ───────────────────────────────────────────────────────────────────
  loading: true,
  formData: null,
  blockLayouts: [],
  selectedBlockLayout: null,
  selectedChildId: null,
  history: [],
  historyIndex: -1,
  isApplyingHistory: false,

  // ─── Setters simples ─────────────────────────────────────────────────────────
  setFormData: (formData) => set({ formData }),

  updateSettings: (updates) => {
    set((state) => {
      if (!state.formData || !state.formData.settings) return state;
      return {
        formData: {
          ...state.formData,
          settings: {
            ...state.formData.settings,
            ...updates,
          },
        },
      };
    });
  },

  updateAnyBlock: (id, updatedBlock, parentId) => {
    if (parentId) {
      get().updateChildBlock(parentId, id, updatedBlock);
      return;
    }
    set((state) => ({
      blockLayouts: state.blockLayouts.map((block) => {
        if (block.id !== id) return block;
        return { ...block, ...updatedBlock };
      }),
      selectedBlockLayout:
        state.selectedBlockLayout?.id === id
          ? { ...state.selectedBlockLayout, ...updatedBlock }
          : state.selectedBlockLayout,
    }));
  },

  setBlockLayouts: (updater) =>
    set((state) => ({
      blockLayouts:
        typeof updater === "function" ? updater(state.blockLayouts) : updater,
    })),

  // ─── Fetch ───────────────────────────────────────────────────────────────────
  fetchFormById: async (formId) => {
    try {
      set({ loading: true });
      if (!formId) return;

      const { form } = await client.form.get({ id: formId });

      if (!form) {
        throw new Error("Failed to fetch form");
      }

      set({ formData: form as any });

      if (form.jsonBlock) {
        const parsedBlocks: FormBlockInstance[] = JSON.parse(form.jsonBlock);
        set({ blockLayouts: parsedBlocks });
      }
    } catch (error) {
      console.error("Error fetching form:", error);
    } finally {
      set({ loading: false });
    }
  },

  // ─── Add ─────────────────────────────────────────────────────────────────────
  addBlockLayout: (blockLayout) => {
    set((state) => ({
      blockLayouts: [...state.blockLayouts, blockLayout],
      selectedBlockLayout: blockLayout,
    }));
  },

  // ─── Remove ──────────────────────────────────────────────────────────────────
  removeBlockLayout: (id) => {
    set((state) => ({
      blockLayouts: state.blockLayouts.filter((block) => block.id !== id),
      selectedBlockLayout:
        state.selectedBlockLayout?.id === id ? null : state.selectedBlockLayout,
    }));
  },

  // ─── Duplicate ───────────────────────────────────────────────────────────────
  duplicateBlockLayout: (id) => {
    set((state) => {
      const blockToDuplicate = state.blockLayouts.find(
        (block) => block.id === id,
      );
      if (!blockToDuplicate) return state;

      const duplicatedLayoutBlock: FormBlockInstance = {
        ...blockToDuplicate,
        id: `layout-${uuidv4()}`,
        childblocks: blockToDuplicate.childblocks?.map((childblock) => ({
          ...childblock,
          id: uuidv4(),
        })),
      };

      const updatedBlockLayouts = [...state.blockLayouts];
      const insertIndex =
        state.blockLayouts.findIndex((block) => block.id === id) + 1;
      updatedBlockLayouts.splice(insertIndex, 0, duplicatedLayoutBlock);

      return { blockLayouts: updatedBlockLayouts };
    });
  },

  // ─── Select ──────────────────────────────────────────────────────────────────
  handleSelectedLayout: (blockLayout) => {
    // Trocar de layout reseta o child selecionado
    set((state) => ({
      selectedBlockLayout: blockLayout,
      selectedChildId:
        state.selectedBlockLayout?.id === blockLayout?.id
          ? state.selectedChildId
          : null,
    }));
  },

  setSelectedChildId: (id) => set({ selectedChildId: id }),

  // ─── Reposition ──────────────────────────────────────────────────────────────
  repositionBlockLayout: (activeId, overId, position) => {
    set((state) => {
      const activeIndex = state.blockLayouts.findIndex(
        (block) => block.id === activeId,
      );
      const overIndex = state.blockLayouts.findIndex(
        (block) => block.id === overId,
      );

      if (activeIndex === -1 || overIndex === -1) {
        return state;
      }

      const updatedBlocks = [...state.blockLayouts];
      const [movedBlock] = updatedBlocks.splice(activeIndex, 1);
      const insertIndex = position === "above" ? overIndex : overIndex + 1;
      updatedBlocks.splice(insertIndex, 0, movedBlock);

      return { blockLayouts: updatedBlocks };
    });
  },

  // ─── Insert at index ─────────────────────────────────────────────────────────
  insertBlockLayoutAtIndex: (overId, newBlockLayout, position) => {
    set((state) => {
      const overIndex = state.blockLayouts.findIndex(
        (block) => block.id === overId,
      );
      if (overIndex === -1) return state;

      const insertIndex = position === "above" ? overIndex : overIndex + 1;
      const updatedBlocks = [...state.blockLayouts];
      updatedBlocks.splice(insertIndex, 0, newBlockLayout);

      return {
        blockLayouts: updatedBlocks,
        selectedBlockLayout: newBlockLayout,
      };
    });
  },

  // ─── Update block layout (children) ──────────────────────────────────────────
  updateBlockLayout: (id, childrenBlocks) => {
    set((state) => {
      const updatedBlockLayouts = state.blockLayouts.map((block) =>
        block.id === id ? { ...block, childblocks: childrenBlocks } : block,
      );

      return {
        blockLayouts: updatedBlockLayouts,
        selectedBlockLayout:
          state.selectedBlockLayout?.id === id
            ? { ...state.selectedBlockLayout, childblocks: childrenBlocks }
            : state.selectedBlockLayout,
      };
    });
  },

  // ─── Update child block ───────────────────────────────────────────────────────
  updateChildBlock: (parentId, childblockId, updatedBlock) => {
    set((state) => ({
      blockLayouts: state.blockLayouts.map((parentBlock) => {
        if (parentBlock.id !== parentId) return parentBlock;

        const updatedChildblocks = parentBlock.childblocks?.map((childblock) =>
          childblock.id === childblockId
            ? { ...childblock, ...updatedBlock }
            : childblock,
        );

        return { ...parentBlock, childblocks: updatedChildblocks };
      }),
      selectedBlockLayout:
        state.selectedBlockLayout?.id === parentId
          ? {
              ...state.selectedBlockLayout,
              childblocks: state.selectedBlockLayout.childblocks?.map(
                (childblock) =>
                  childblock.id === childblockId
                    ? { ...childblock, ...updatedBlock }
                    : childblock,
              ),
            }
          : state.selectedBlockLayout,
    }));
  },

  // ─── Histórico (undo/redo) ─────────────────────────────────────────────
  pushHistorySnapshot: () => {
    const state = get();
    if (state.isApplyingHistory) return;
    const snapshot: HistorySnapshot = {
      // deep-ish clone via JSON pra garantir isolamento das referências
      blockLayouts: JSON.parse(JSON.stringify(state.blockLayouts)),
      settings: state.formData?.settings
        ? JSON.parse(JSON.stringify(state.formData.settings))
        : null,
    };
    // Truncar futuro (descarta redos pendentes) e limitar tamanho a 80
    const truncated = state.history.slice(0, state.historyIndex + 1);
    const next = [...truncated, snapshot].slice(-80);
    set({
      history: next,
      historyIndex: next.length - 1,
    });
  },

  undo: () => {
    const state = get();
    if (state.historyIndex <= 0) return false;
    const targetIndex = state.historyIndex - 1;
    const target = state.history[targetIndex];
    if (!target) return false;
    set((s) => ({
      isApplyingHistory: true,
      blockLayouts: JSON.parse(JSON.stringify(target.blockLayouts)),
      historyIndex: targetIndex,
      formData:
        s.formData && target.settings
          ? { ...s.formData, settings: JSON.parse(JSON.stringify(target.settings)) }
          : s.formData,
    }));
    setTimeout(() => set({ isApplyingHistory: false }), 0);
    return true;
  },

  redo: () => {
    const state = get();
    if (state.historyIndex >= state.history.length - 1) return false;
    const targetIndex = state.historyIndex + 1;
    const target = state.history[targetIndex];
    if (!target) return false;
    set((s) => ({
      isApplyingHistory: true,
      blockLayouts: JSON.parse(JSON.stringify(target.blockLayouts)),
      historyIndex: targetIndex,
      formData:
        s.formData && target.settings
          ? { ...s.formData, settings: JSON.parse(JSON.stringify(target.settings)) }
          : s.formData,
    }));
    setTimeout(() => set({ isApplyingHistory: false }), 0);
    return true;
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => {
    const s = get();
    return s.historyIndex < s.history.length - 1;
  },
}));
