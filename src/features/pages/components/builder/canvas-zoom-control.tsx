"use client";

import { Maximize, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePagesBuilderStore } from "../../context/pages-builder-store";

const ZOOM_STEP = 0.1;

/** Pílula flutuante de zoom do canvas; "Ajustar" volta a acompanhar a largura disponível. */
export function CanvasZoomControl() {
  const zoom = usePagesBuilderStore((state) => state.zoom);
  const isZoomFit = usePagesBuilderStore((state) => state.isZoomFit);
  const setZoom = usePagesBuilderStore((state) => state.setZoom);
  const setZoomFit = usePagesBuilderStore((state) => state.setZoomFit);

  const zoomButtonClasses =
    "grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center max-md:hidden">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border bg-card p-1 shadow-lg">
        <button
          type="button"
          className={zoomButtonClasses}
          onClick={() => setZoom(zoom - ZOOM_STEP)}
          title="Diminuir zoom"
          aria-label="Diminuir zoom"
        >
          <Minus className="size-4" />
        </button>
        <span className="w-12 text-center text-xs font-medium tabular-nums">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className={zoomButtonClasses}
          onClick={() => setZoom(zoom + ZOOM_STEP)}
          title="Aumentar zoom"
          aria-label="Aumentar zoom"
        >
          <Plus className="size-4" />
        </button>
        <div className="mx-0.5 h-4 w-px bg-border" />
        <button
          type="button"
          className={cn(
            "flex h-8 items-center gap-1 rounded-full px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            isZoomFit && "text-foreground",
          )}
          onClick={() => setZoomFit(true)}
          title="Ajustar à tela"
          aria-pressed={isZoomFit}
        >
          <Maximize className="size-3.5" />
          Ajustar
        </button>
      </div>
    </div>
  );
}
