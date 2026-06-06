"use client";

import { nanoid } from "nanoid";
import { create } from "zustand";
import type { Device, ElementBase, PageLayout } from "../types";
import { isFlowSection } from "../lib/section-flow";

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
  /** ID da subpage atualmente em edição. NULL = root selecionado. */
  activeSubpageId: string | null;

  setPage: (pageId: string, layout: PageLayout) => void;
  setLayout: (layout: PageLayout, pushHistory?: boolean) => void;
  setDevice: (d: Device) => void;
  setZoom: (z: number) => void;
  setActiveLayer: (l: ActiveLayer) => void;
  setSelected: (ids: string[]) => void;
  toggleSelected: (id: string, additive?: boolean) => void;
  setActiveSubpage: (id: string | null) => void;
  addElement: (el: ElementBase) => void;
  insertElementAt: (el: ElementBase, targetIndex: number) => void;
  updateElement: (id: string, patch: Partial<ElementBase>) => void;
  removeElement: (id: string) => void;
  duplicateSelected: () => void;
  /** Reordena element por id pra um novo índice no array da layer ativa. Reindexa Y se for flow section. */
  moveElement: (id: string, targetIndex: number) => void;
  /** Agrupa N elements selecionados num único element type="group" com children embutidos. Retorna o id do grupo criado. */
  groupElements: (ids: string[]) => string | null;
  /** Desagrupa um element type="group", devolvendo seus children pro top-level no mesmo índice. */
  ungroupElement: (id: string) => void;
  /** Toggle do campo `hidden`. */
  toggleVisibility: (id: string) => void;
  /** Toggle do campo `locked`. */
  toggleLock: (id: string) => void;
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

/**
 * Recalcula y cumulativo dos flow sections seguindo a ORDEM atual do
 * array. Necessário sempre que `moveElement`, `insertElementAt`,
 * `groupElements` ou `ungroupElement` mexem com a lista — sem isso a
 * renderização pública (que ordena por `y`) ignora a nova ordem do
 * array.
 *
 * Átomos mantêm `x/y` originais (não-flow não participa do empilhamento).
 */
function reindexFlowY(elements: ElementBase[]): ElementBase[] {
  let cumulativeY = 0;
  return elements.map((el) => {
    if (!isFlowSection(el.type)) return el;
    const next = { ...el, x: 0, y: cumulativeY };
    cumulativeY += el.h;
    return next;
  });
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
  activeSubpageId: null,

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

  setActiveSubpage: (activeSubpageId) => set({ activeSubpageId, selected: [] }),

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
    const next = withLayer(layout, activeLayer, (els) => {
      const updated = els.map((e) => (e.id === id ? { ...e, ...patch } : e));
      // Quando uma FLOW SECTION muda `h` (auto-altura do canvas via
      // ResizeObserver, ou resize manual via handle), as sections
      // abaixo precisam deslocar pra acompanhar — senão ficam
      // sobrepostas. Reindex em cascata baseado na ORDEM do array.
      const changed = updated.find((e) => e.id === id);
      const hChanged = patch.h !== undefined && changed && isFlowSection(changed.type);
      if (hChanged) return reindexFlowY(updated);
      return updated;
    });
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

  insertElementAt: (el, targetIndex) => {
    const { layout, activeLayer } = get();
    if (!layout) return;
    const next = withLayer(layout, activeLayer, (els) => {
      const clampedIndex = Math.max(0, Math.min(targetIndex, els.length));
      const inserted = [...els.slice(0, clampedIndex), el, ...els.slice(clampedIndex)];
      // Se for flow section ou se há flow sections na pilha, reindexa
      // Y pra o array novo. Pra atoms puros (sem flow), não mexe em Y.
      const hasAnyFlow = inserted.some((e) => isFlowSection(e.type));
      return hasAnyFlow ? reindexFlowY(inserted) : inserted;
    });
    get().setLayout(next);
    set({ selected: [el.id] });
  },

  moveElement: (id, targetIndex) => {
    const { layout, activeLayer } = get();
    if (!layout) return;
    const next = withLayer(layout, activeLayer, (els) => {
      const fromIdx = els.findIndex((e) => e.id === id);
      if (fromIdx === -1) return els;
      const clamped = Math.max(0, Math.min(targetIndex, els.length - 1));
      if (clamped === fromIdx) return els;
      const without = [...els.slice(0, fromIdx), ...els.slice(fromIdx + 1)];
      // targetIndex pré-remove pode ficar fora do range pós-remove —
      // ajusta pra trás se moveu pra frente.
      const adjusted = clamped > fromIdx ? clamped - 1 : clamped;
      const reordered = [...without.slice(0, adjusted), els[fromIdx], ...without.slice(adjusted)];
      const hasAnyFlow = reordered.some((e) => isFlowSection(e.type));
      return hasAnyFlow ? reindexFlowY(reordered) : reordered;
    });
    get().setLayout(next);
  },

  groupElements: (ids) => {
    const { layout, activeLayer } = get();
    if (!layout || ids.length < 2) return null;
    const els = getLayer(layout, activeLayer).elements;
    // Pega elements selecionados PRESERVANDO a ordem do array (não a
    // ordem que o user clicou pra selecionar).
    const ordered = els.filter((e) => ids.includes(e.id));
    if (ordered.length < 2) return null;
    // Bounding box do grupo: min de (x,y) + max de (x+w, y+h) dos children.
    const minX = Math.min(...ordered.map((e) => e.x));
    const minY = Math.min(...ordered.map((e) => e.y));
    const maxX = Math.max(...ordered.map((e) => e.x + e.w));
    const maxY = Math.max(...ordered.map((e) => e.y + e.h));
    const groupId = `el_${nanoid(10)}`;
    const group: ElementBase = {
      id: groupId,
      type: "group",
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
      children: ordered,
    };
    // Posição do grupo no array = posição do primeiro filho selecionado.
    const firstIdx = els.findIndex((e) => ids.includes(e.id));
    const next = withLayer(layout, activeLayer, (arr) => {
      const without = arr.filter((e) => !ids.includes(e.id));
      const insertAt = Math.min(firstIdx, without.length);
      const inserted = [...without.slice(0, insertAt), group, ...without.slice(insertAt)];
      const hasAnyFlow = inserted.some((e) => isFlowSection(e.type));
      return hasAnyFlow ? reindexFlowY(inserted) : inserted;
    });
    get().setLayout(next);
    set({ selected: [groupId] });
    return groupId;
  },

  ungroupElement: (id) => {
    const { layout, activeLayer } = get();
    if (!layout) return;
    const els = getLayer(layout, activeLayer).elements;
    const group = els.find((e) => e.id === id);
    if (!group || group.type !== "group") return;
    const children = (group.children as ElementBase[]) ?? [];
    if (children.length === 0) {
      // Grupo vazio — só remove.
      get().removeElement(id);
      return;
    }
    const groupIdx = els.findIndex((e) => e.id === id);
    const next = withLayer(layout, activeLayer, (arr) => {
      const without = [...arr.slice(0, groupIdx), ...arr.slice(groupIdx + 1)];
      const inserted = [...without.slice(0, groupIdx), ...children, ...without.slice(groupIdx)];
      const hasAnyFlow = inserted.some((e) => isFlowSection(e.type));
      return hasAnyFlow ? reindexFlowY(inserted) : inserted;
    });
    get().setLayout(next);
    set({ selected: children.map((c) => c.id) });
  },

  toggleVisibility: (id) => {
    const { layout, activeLayer } = get();
    if (!layout) return;
    const els = getLayer(layout, activeLayer).elements;
    const el = els.find((e) => e.id === id);
    if (!el) return;
    get().updateElement(id, { hidden: !el.hidden });
  },

  toggleLock: (id) => {
    const { layout, activeLayer } = get();
    if (!layout) return;
    const els = getLayer(layout, activeLayer).elements;
    const el = els.find((e) => e.id === id);
    if (!el) return;
    get().updateElement(id, { locked: !el.locked });
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
