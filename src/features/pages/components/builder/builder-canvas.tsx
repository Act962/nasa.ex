"use client";

import { useRef, useEffect } from "react";
import { usePagesBuilderStore, getActiveLayerElements } from "../../context/pages-builder-store";
import { ElementBox } from "../elements/element-box";
import type { ElementBase } from "../../types";

export function BuilderCanvas() {
  const layout = usePagesBuilderStore((s) => s.layout);
  const zoom = usePagesBuilderStore((s) => s.zoom);
  const activeLayer = usePagesBuilderStore((s) => s.activeLayer);
  const setSelected = usePagesBuilderStore((s) => s.setSelected);
  const selected = usePagesBuilderStore((s) => s.selected);
  const removeElement = usePagesBuilderStore((s) => s.removeElement);
  const duplicateSelected = usePagesBuilderStore((s) => s.duplicateSelected);
  const updateElement = usePagesBuilderStore((s) => s.updateElement);
  const undo = usePagesBuilderStore((s) => s.undo);
  const redo = usePagesBuilderStore((s) => s.redo);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        selected.forEach((id) => removeElement(id));
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        const lay = usePagesBuilderStore.getState().layout;
        const layer = usePagesBuilderStore.getState().activeLayer;
        if (lay) {
          const ids = getActiveLayerElements(lay, layer).map((el) => el.id);
          setSelected(ids);
        }
        return;
      }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key) && selected.length > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        selected.forEach((id) => {
          const lay = usePagesBuilderStore.getState().layout;
          const layer = usePagesBuilderStore.getState().activeLayer;
          if (!lay) return;
          const el = getActiveLayerElements(lay, layer).find((e) => e.id === id);
          if (!el) return;
          updateElement(id, { x: el.x + dx, y: el.y + dy });
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, removeElement, duplicateSelected, updateElement, setSelected, undo, redo]);

  if (!layout) return null;

  const artboardWidth = layout.artboard.width ?? 1440;
  const minHeight = layout.artboard.minHeight;
  const elements = getActiveLayerElements(layout, activeLayer);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setSelected([]);
  };

  return (
    <div
      ref={scrollRef}
      data-pages-canvas-scroll
      className="flex-1 overflow-auto py-8 flex justify-center"
      style={{ background: "repeating-linear-gradient(45deg, #f5f5f5, #f5f5f5 10px, #ffffff 10px, #ffffff 20px)" }}
      onClick={handleCanvasClick}
    >
      <div
        style={{
          width: artboardWidth * zoom,
          height: minHeight * zoom,
          flexShrink: 0,
          position: "relative",
        }}
      >
        <div
          data-pages-artboard
          className="relative bg-white shadow-lg rounded-sm"
          style={{
            width: artboardWidth,
            minHeight,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            background: layout.artboard.background ?? "#ffffff",
          }}
        >
          {layout.mode === "stacked" ? (
            <>
              <LayerSurface
                elements={layout.back.elements}
                dimmed={activeLayer !== "back"}
                active={activeLayer === "back"}
              />
              <LayerSurface
                elements={layout.front.elements}
                dimmed={activeLayer !== "front"}
                active={activeLayer === "front"}
              />
            </>
          ) : (
            <LayerSurface elements={elements} active={true} />
          )}
        </div>
      </div>
    </div>
  );
}

function LayerSurface({
  elements,
  active,
  dimmed,
}: {
  elements: Array<ElementBase>;
  active: boolean;
  dimmed?: boolean;
}) {
  return (
    <div
      className="absolute inset-0"
      style={{
        opacity: dimmed ? 0.35 : 1,
        pointerEvents: active ? "auto" : "none",
      }}
    >
      {elements.map((el) => (
        <ElementBox key={el.id} element={el as never} editable={active} />
      ))}
    </div>
  );
}
