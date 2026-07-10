"use client";

import { memo, RefObject, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { useHorizontalScrollMap } from "../hooks/use-horizontal-scroll-map";

type MinimapColumn = {
  id: string;
  color: string | null;
};

interface KanbanMinimapProps {
  /** Ref do elemento que rola horizontalmente (o `<ol>` das colunas). */
  scrollRef: RefObject<HTMLOListElement | null>;
  /** Lista de colunas, na mesma ordem da board. */
  columns: MinimapColumn[];
}

// Tamanho do minimapa — fixo, compacto, ancorado no canto inferior direito.
const MINIMAP_TRACK_CLASS =
  "relative flex h-full w-44 items-stretch gap-px overflow-hidden rounded";

function KanbanMinimapComponent({ scrollRef, columns }: KanbanMinimapProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const { hasOverflow, viewportRatio, scrollRatio, scrollToRatio } =
    useHorizontalScrollMap(scrollRef);

  // Converte uma posição X (em px, relativa à trilha) para fração 0..1 do
  // conteúdo, compensando metade da largura do viewport para centralizar o
  // clique/arraste no retângulo.
  const pointerToRatio = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return 0;

      const rect = track.getBoundingClientRect();
      if (rect.width === 0) return 0;

      const viewportWidth = viewportRatio * rect.width;
      const usable = rect.width - viewportWidth;
      if (usable <= 0) return 0;

      const offset = clientX - rect.left - viewportWidth / 2;
      return offset / usable;
    },
    [viewportRatio],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      // Salto inicial suave; durante o arraste seguimos sem smooth.
      scrollToRatio(pointerToRatio(event.clientX), true);
    },
    [pointerToRatio, scrollToRatio],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      scrollToRatio(pointerToRatio(event.clientX), false);
    },
    [pointerToRatio, scrollToRatio],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [],
  );

  if (!hasOverflow) return null;

  const viewportWidthPercent = viewportRatio * 100;
  // `left` percorre o espaço livre (100% - largura do viewport).
  const viewportLeftPercent = scrollRatio * (100 - viewportWidthPercent);

  return (
    <div
      className={cn(
        "absolute bottom-3 left-3 z-30 h-9 rounded-md border border-border",
        "bg-background/80 p-1 shadow-sm backdrop-blur-sm",
        "select-none opacity-30 transition-opacity duration-200 hover:opacity-100",
      )}
      aria-hidden
    >
      <div
        ref={trackRef}
        className={cn(MINIMAP_TRACK_CLASS, "cursor-pointer")}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {columns.map((column) => (
          <div
            key={column.id}
            className="h-full flex-1 rounded-[2px]"
            style={{
              backgroundColor: "var(--muted-foreground)",
              opacity: 0.35,
            }}
          />
        ))}

        <div
          className={cn(
            "pointer-events-none absolute top-0 h-full rounded",
            "border border-foreground/40 bg-foreground/10",
          )}
          style={{
            width: `${viewportWidthPercent}%`,
            left: `${viewportLeftPercent}%`,
          }}
        />
      </div>
    </div>
  );
}

export const KanbanMinimap = memo(KanbanMinimapComponent);
