"use client";

import { create } from "zustand";
import { FormBlockInstance, FormWithSettings } from "../types";
import { v4 as uuidv4 } from "uuid";
import { client } from "@/lib/orpc";
import { FormSettings } from "@/generated/prisma/client";

type BuilderState = {
  loading: boolean;
  formData: FormWithSettings | null;
  blockLayouts: FormBlockInstance[];
  selectedBlockLayout: FormBlockInstance | null;
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
};

export type BuilderStore = BuilderState & BuilderActions;

export const useBuilderStore = create<BuilderStore>((set, get) => ({
  // ─── State ───────────────────────────────────────────────────────────────────
  loading: true,
  formData: null,
  blockLayouts: [],
  selectedBlockLayout: null,

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
      blockLayouts: state.blockLayouts.map((block) =>
        block.id === id ? { ...block, ...updatedBlock } : block,
      ),
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
    set({ selectedBlockLayout: blockLayout });
  },

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

      return { blockLayouts: updatedBlocks };
    });
  },

  // ─── Update block layout (children) ──────────────────────────────────────────
  updateBlockLayout: (id, childrenBlocks) => {
    set((state) => ({
      blockLayouts: state.blockLayouts.map((block) =>
        block.id === id ? { ...block, childblocks: childrenBlocks } : block,
      ),
    }));
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
    }));
  },
}));
