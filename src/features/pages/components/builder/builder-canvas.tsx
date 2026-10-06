"use client";

import { useEffect, useState } from "react";
import { usePagesBuilderStore, getActiveLayerElements } from "../../context/pages-builder-store";
import { ElementBox } from "../elements/element-box";
import type { Device, ElementBase } from "../../types";
import { CanvasZoomControl } from "./canvas-zoom-control";

const CANVAS_GUTTER_PX = 32;
const DEVICE_PREVIEW_MIN_HEIGHT_PX = 480;
// Larguras que caem nos breakpoints reais da página publicada (tablet < 1024, celular < 640).
const DEVICE_PREVIEW_WIDTHS: Record<Exclude<Device, "desktop">, number> = { tablet: 768, mobile: 375 };
const DEVICE_PREVIEW_LABELS: Record<Exclude<Device, "desktop">, string> = { tablet: "tablet", mobile: "celular" };

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
  const groupElements = usePagesBuilderStore((s) => s.groupElements);
  const ungroupElement = usePagesBuilderStore((s) => s.ungroupElement);
  const toggleVisibility = usePagesBuilderStore((s) => s.toggleVisibility);
  const toggleLock = usePagesBuilderStore((s) => s.toggleLock);

  const pageId = usePagesBuilderStore((s) => s.pageId);
  const device = usePagesBuilderStore((s) => s.device);
  const isZoomFit = usePagesBuilderStore((s) => s.isZoomFit);
  const applyFitZoom = usePagesBuilderStore((s) => s.applyFitZoom);
  const savedRevision = usePagesBuilderStore((s) => s.savedRevision);

  const [scrollNode, setScrollNode] = useState<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

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
      // ── Cmd/Ctrl+Shift+G: desagrupar (precisa do shift ANTES de
      //    cair no Cmd+G normal). 1 group selecionado → vira filhos
      //    no top-level mesma ordem.
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === "g" || e.key === "G")
      ) {
        e.preventDefault();
        if (selected.length === 1) {
          const lay = usePagesBuilderStore.getState().layout;
          const layer = usePagesBuilderStore.getState().activeLayer;
          if (lay) {
            const el = getActiveLayerElements(lay, layer).find(
              (x) => x.id === selected[0],
            );
            if (el?.type === "group") ungroupElement(selected[0]);
          }
        }
        return;
      }
      // ── Cmd/Ctrl+G: agrupar 2+ elements selecionados.
      if ((e.metaKey || e.ctrlKey) && (e.key === "g" || e.key === "G")) {
        e.preventDefault();
        if (selected.length >= 2) groupElements(selected);
        return;
      }
      // ── H: toggle visibility do selected (Photoshop-style).
      if (!e.metaKey && !e.ctrlKey && (e.key === "h" || e.key === "H")) {
        if (selected.length === 0) return;
        e.preventDefault();
        selected.forEach((id) => toggleVisibility(id));
        return;
      }
      // ── L: toggle lock do selected.
      if (!e.metaKey && !e.ctrlKey && (e.key === "l" || e.key === "L")) {
        if (selected.length === 0) return;
        e.preventDefault();
        selected.forEach((id) => toggleLock(id));
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
  }, [
    selected, removeElement, duplicateSelected, updateElement, setSelected,
    undo, redo, groupElements, ungroupElement, toggleVisibility, toggleLock,
  ]);

  useEffect(() => {
    if (!scrollNode) return;
    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry) setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    resizeObserver.observe(scrollNode);
    return () => resizeObserver.disconnect();
  }, [scrollNode]);

  const artboardWidth = layout?.artboard.width ?? 1440;
  const frameWidth = device === "desktop" ? artboardWidth : DEVICE_PREVIEW_WIDTHS[device];

  useEffect(() => {
    if (!isZoomFit || viewportSize.width <= 0) return;
    applyFitZoom((viewportSize.width - CANVAS_GUTTER_PX * 2) / frameWidth);
  }, [isZoomFit, viewportSize.width, frameWidth, applyFitZoom]);

  if (!layout) return null;

  const elements = getActiveLayerElements(layout, activeLayer);

  // Altura real do canvas = max(minHeight do artboard, bottom da última
  // section/elemento). Sem isso o scroll wrapper trava em `minHeight`
  // e as sections que crescem (via auto-altura) ficam cortadas embaixo,
  // tornando impossível visualizar/clicar nas últimas sections.
  const contentBottom = elements.reduce(
    (max, el) => Math.max(max, (el.y ?? 0) + (el.h ?? 0)),
    0,
  );
  const minHeight = Math.max(layout.artboard.minHeight, contentBottom + 40);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setSelected([]);
  };

  const previewFrameHeight = Math.max(
    DEVICE_PREVIEW_MIN_HEIGHT_PX,
    (viewportSize.height - CANVAS_GUTTER_PX * 2) / zoom,
  );

  return (
    <div className="relative flex min-w-0 flex-1 flex-col">
      {device !== "desktop" && (
        <p className="shrink-0 border-b bg-card px-4 py-1.5 text-center text-[11px] text-muted-foreground">
          Prévia em {DEVICE_PREVIEW_LABELS[device]}, atualizada a cada salvamento. Para editar, selecione o
          bloco em <strong className="text-foreground">Camadas</strong> ou volte para Computador.
        </p>
      )}
      <div
        ref={setScrollNode}
        data-pages-canvas-scroll
        className="min-h-0 flex-1 overflow-auto bg-panel bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:20px_20px] pt-8 pb-20"
        onClick={handleCanvasClick}
      >
        {device !== "desktop" ? (
          <div
            className="relative mx-auto shrink-0"
            style={{ width: frameWidth * zoom, height: previewFrameHeight * zoom }}
          >
            <iframe
              key={device}
              title={`Prévia em ${DEVICE_PREVIEW_LABELS[device]}`}
              src={`/pages/${pageId}/preview?preview=1&v=${savedRevision}`}
              sandbox="allow-same-origin allow-scripts"
              className="absolute top-0 left-0 origin-top-left rounded-[18px] border bg-white shadow-lg"
              style={{ width: frameWidth, height: previewFrameHeight, transform: `scale(${zoom})` }}
            />
          </div>
        ) : (
          <div
            className="relative mx-auto shrink-0"
            style={{ width: artboardWidth * zoom, height: minHeight * zoom }}
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
        )}
      </div>
      <CanvasZoomControl />
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
