"use client";

import { nanoid } from "nanoid";
import { create } from "zustand";
import type { Device, ElementBase, PageLayout } from "../types";

type ActiveLayer = "main" | "back" | "front";

interface BuilderState {
  pageId: string | null;
  layout: PageLayout | null;
  device: Device;
  zoom: number;
  activeLayer: ActiveLayer;
  selected: string[];
  history: PageLayout[];
  historyIndex: number;

  setPage: (pageId: string, layout: PageLayout) => void;
  setLayout: (layout: PageLayout, pushHistory?: boolean) => void;
  setDevice: (d: Device) => void;
  setZoom: (z: number) => void;
  setActiveLayer: (l: ActiveLayer) => void;
  setSelected: (ids: string[]) => void;
  toggleSelected: (id: string, additive?: boolean) => void;
  addElement: (el: ElementBase) => void;
  updateElement: (id: string, patch: Partial<ElementBase>) => void;
  removeElement: (id: string) => void;
  duplicateSelected: () => void;
  updateArtboard: (patch: Partial<{ width: number; minHeight: number; background: string }>) => void;
  updateMeta: (patch: Record<string, unknown>) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

function getLayer(layout: PageLayout, layer: ActiveLayer) {
  if (layout.mode === "single") return layout.main;
  return layer === "back" ? layout.back : layout.front;
}

function withLayer(
  layout: PageLayout,
  layer: ActiveLayer,
  mapper: (els: ElementBase[]) => ElementBase[],
): PageLayout {
  if (layout.mode === "single") {
    return { ...layout, main: { ...layout.main, elements: mapper(layout.main.elements) } };
  }
  if (layer === "back") {
    return { ...layout, back: { ...layout.back, elements: mapper(layout.back.elements) } };
  }
  return { ...layout, front: { ...layout.front, elements: mapper(layout.front.elements) } };
}

export const usePagesBuilderStore = create<BuilderState>((set, get) => ({
  pageId: null,
  layout: null,
  device: "desktop",
  zoom: 1,
  activeLayer: "main",
  selected: [],
  history: [],
  historyIndex: -1,

  setPage: (pageId, layout) => {
    const defaultLayer: ActiveLayer = layout.mode === "single" ? "main" : "front";
    set({
      pageId,
      layout,
      activeLayer: defaultLayer,
      selected: [],
      history: [layout],
      historyIndex: 0,
    });
  },

  setLayout: (layout, pushHistory = true) => {
    const { history, historyIndex } = get();
    if (pushHistory) {
      const nextHistory = history.slice(0, historyIndex + 1).concat(layout).slice(-50);
      set({
        layout,
        history: nextHistory,
        historyIndex: nextHistory.length - 1,
      });
    } else {
      set({ layout });
    }
  },

  setDevice: (device) => set({ device }),
  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(2, zoom)) }),
  setActiveLayer: (activeLayer) => set({ activeLayer, selected: [] }),

  setSelected: (ids) => set({ selected: ids }),

  toggleSelected: (id, additive = false) => {
    const { selected } = get();
    if (additive) {
      set({
        selected: selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id],
      });
    } else {
      set({ selected: [id] });
    }
  },

  addElement: (el) => {
    const { layout, activeLayer } = get();
    if (!layout) return;
    const next = withLayer(layout, activeLayer, (els) => [...els, el]);
    get().setLayout(next);
    set({ selected: [el.id] });
  },

  updateElement: (id, patch) => {
    const { layout, activeLayer } = get();
    if (!layout) return;
    const next = withLayer(layout, activeLayer, (els) =>
      els.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
    get().setLayout(next);
  },

  removeElement: (id) => {
    const { layout, activeLayer, selected } = get();
    if (!layout) return;
    const next = withLayer(layout, activeLayer, (els) => els.filter((e) => e.id !== id));
    get().setLayout(next);
    set({ selected: selected.filter((s) => s !== id) });
  },

  duplicateSelected: () => {
    const { layout, activeLayer, selected } = get();
    if (!layout || selected.length === 0) return;
    const els = getLayer(layout, activeLayer).elements;
    const newIds: string[] = [];
    let next = layout;
    for (const id of selected) {
      const el = els.find((e) => e.id === id);
      if (!el) continue;
      const newId = `el_${nanoid(10)}`;
      newIds.push(newId);
      next = withLayer(next, activeLayer, (arr) => [
        ...arr,
        { ...el, id: newId, x: el.x + 16, y: el.y + 16 },
      ]);
    }
    get().setLayout(next);
    set({ selected: newIds });
  },

  updateArtboard: (patch) => {
    const { layout } = get();
    if (!layout) return;
    const next = { ...layout, artboard: { ...layout.artboard, ...patch } };
    get().setLayout(next);
  },

  updateMeta: (patch) => {
    const { layout } = get();
    if (!layout) return;
    const currentMeta =
      (layout as unknown as { meta?: Record<string, unknown> }).meta ?? {};
    const next = {
      ...layout,
      meta: { ...currentMeta, ...patch },
    } as unknown as typeof layout;
    get().setLayout(next);
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    set({ layout: history[historyIndex - 1], historyIndex: historyIndex - 1 });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    set({ layout: history[historyIndex + 1], historyIndex: historyIndex + 1 });
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => {
    const { history, historyIndex } = get();
    return historyIndex < history.length - 1;
  },
}));

export function getActiveLayerElements(
  layout: PageLayout | null,
  activeLayer: ActiveLayer,
): ElementBase[] {
  if (!layout) return [];
  return getLayer(layout, activeLayer).elements;
}
