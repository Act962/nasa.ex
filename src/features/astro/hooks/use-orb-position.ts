"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  anchorToCenter,
  centerToAnchor,
  clampOrbCenter,
  type Point,
  type Viewport,
} from "@/features/astro/lib/orb-layout";
import { useAstroOrbStore } from "@/features/astro/voice/use-astro-orb-store";

/**
 * Posição do ASTRO arrastável (spec 0029). Orb e painel leem daqui: o centro
 * do orb em pixels, já considerando o arraste em andamento e o tamanho atual
 * da janela.
 */

/**
 * Tamanho da janela. Começa num valor fixo para servidor e cliente renderizarem
 * igual (sem aviso de hidratação); o tamanho real entra logo após montar, e
 * `isMeasured` avisa quando já dá para mostrar o orb sem ele "pular".
 */
const INITIAL_VIEWPORT: Viewport = { width: 1280, height: 800 };

export function useViewport(): { viewport: Viewport; isMeasured: boolean } {
  const [viewport, setViewport] = useState<Viewport>(INITIAL_VIEWPORT);
  const [isMeasured, setIsMeasured] = useState(false);
  useEffect(() => {
    const handleResize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    handleResize();
    setIsMeasured(true);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return { viewport, isMeasured };
}

export function useOrbCenter(): { center: Point; viewport: Viewport; isMeasured: boolean } {
  const { viewport, isMeasured } = useViewport();
  const anchor = useAstroOrbStore((state) => state.anchor);
  const dragCenter = useAstroOrbStore((state) => state.dragCenter);
  return {
    center: dragCenter ?? anchorToCenter(anchor, viewport),
    viewport,
    isMeasured,
  };
}

/** Movimento mínimo para contar como arraste, e não clique. */
const DRAG_THRESHOLD_PX = 6;

/**
 * Arrastar o orb com mouse ou dedo. Devolve os handlers do botão e um
 * `shouldIgnoreClick` — o `click` que o navegador dispara ao soltar um
 * arraste não pode abrir o painel.
 */
export function useOrbDrag(center: Point, viewport: Viewport) {
  const setDragCenter = useAstroOrbStore((state) => state.setDragCenter);
  const setAnchor = useAstroOrbStore((state) => state.setAnchor);
  const dragStateRef = useRef<{
    pointerId: number;
    startPointer: Point;
    startCenter: Point;
    isDragging: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      // Só botão principal; clique direito e afins seguem o comportamento normal.
      if (event.button !== 0) return;
      dragStateRef.current = {
        pointerId: event.pointerId,
        startPointer: { x: event.clientX, y: event.clientY },
        startCenter: center,
        isDragging: false,
      };
    },
    [center],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - dragState.startPointer.x;
      const deltaY = event.clientY - dragState.startPointer.y;
      if (!dragState.isDragging) {
        if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) return;
        dragState.isDragging = true;
        // Captura só quando vira arraste: clique simples continua clique.
        event.currentTarget.setPointerCapture(event.pointerId);
      }

      setDragCenter(
        clampOrbCenter(
          { x: dragState.startCenter.x + deltaX, y: dragState.startCenter.y + deltaY },
          viewport,
        ),
      );
    },
    [setDragCenter, viewport],
  );

  const finishDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const dragState = dragStateRef.current;
      dragStateRef.current = null;
      if (!dragState || !dragState.isDragging) return;

      suppressClickRef.current = true;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      const finalCenter = useAstroOrbStore.getState().dragCenter;
      if (finalCenter) setAnchor(centerToAnchor(finalCenter, viewport));
      setDragCenter(null);
    },
    [setAnchor, setDragCenter, viewport],
  );

  const shouldIgnoreClick = useCallback(() => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    return true;
  }, []);

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
    },
    shouldIgnoreClick,
    isDragging: useAstroOrbStore((state) => state.dragCenter !== null),
  };
}
