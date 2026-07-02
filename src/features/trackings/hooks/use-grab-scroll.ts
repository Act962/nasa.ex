"use client";

import { RefObject, useEffect, useRef } from "react";

// Elementos onde o "grab to scroll" NÃO deve iniciar: handles de drag do
// dnd-kit (`data-dnd-handle`), controles interativos e áreas marcadas
// explicitamente com `data-no-grab-scroll`. Clicar/arrastar nesses elementos
// preserva o comportamento original (dragar card/coluna, abrir menus, etc.).
const IGNORE_SELECTOR = [
  "[data-dnd-handle]",
  "[data-no-grab-scroll]",
  "button",
  "a",
  "input",
  "textarea",
  "select",
  '[role="button"]',
  '[role="menuitem"]',
  '[contenteditable="true"]',
].join(", ");

// Distância mínima (px) antes de considerar que é um pan, e não um clique.
const START_THRESHOLD = 6;

/**
 * Habilita "arrastar para rolar" (grab scroll) horizontal num elemento
 * scrollável. O usuário clica e segura em qualquer área livre — exceto
 * handles de drag e controles — e move o ponteiro para a esquerda/direita
 * para rolar a board. O cursor vira `grab` (mão aberta) em repouso e
 * `grabbing` (mão fechada) durante o arraste.
 *
 * Implementação via listeners nativos para usar pointer capture e suprimir
 * o `click` sintético que dispararia ao soltar (evita selecionar um lead ao
 * fim de um pan iniciado sobre o corpo do card).
 */
export function useGrabScroll(
  scrollRef: RefObject<HTMLElement | null>,
  // `enabled` deve refletir quando o elemento scrollável está montado.
  // Sem isso, se o hook rodar enquanto a board ainda mostra o skeleton
  // (ref ainda null), os listeners nunca seriam religados ao `<ol>` real.
  enabled = true,
) {
  const dragState = useRef({
    pointerId: null as number | null,
    startX: 0,
    startY: 0,
    startScrollLeft: 0,
    isPanning: false,
    didPan: false,
  });

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !enabled) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return; // apenas botão esquerdo
      const target = event.target as HTMLElement | null;
      if (target?.closest(IGNORE_SELECTOR)) return;

      const state = dragState.current;
      state.pointerId = event.pointerId;
      state.startX = event.clientX;
      state.startY = event.clientY;
      state.startScrollLeft = element.scrollLeft;
      state.isPanning = false;
      state.didPan = false;

      // Fecha a mão (grabbing) JÁ no pointerdown. O browser "trava" o cursor
      // no valor computado no instante em que o botão é pressionado e ignora
      // mudanças de CSS durante o arraste — por isso aplicar a classe só ao
      // cruzar o threshold (mid-drag) não mudava o cursor. Aplicada aqui, a
      // mão entra fechada e assim permanece enquanto o botão estiver segurado.
      document.body.classList.add("is-grab-scrolling");
    };

    const handlePointerMove = (event: PointerEvent) => {
      const state = dragState.current;
      if (state.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - state.startX;
      const deltaY = event.clientY - state.startY;

      if (!state.isPanning) {
        // Só inicia o pan em movimento horizontal dominante — assim um
        // arraste majoritariamente vertical não "rouba" o gesto.
        const isHorizontalDrag =
          Math.abs(deltaX) > START_THRESHOLD &&
          Math.abs(deltaX) > Math.abs(deltaY);
        if (!isHorizontalDrag) return;

        state.isPanning = true;
        state.didPan = true;
        // A classe `is-grab-scrolling` (cursor grabbing) já foi aplicada no
        // pointerdown. Evitamos setPointerCapture de propósito: ele congela o
        // cursor no valor do elemento e mostrava `grab`. Sem captura, o
        // cursor segue `body.is-grab-scrolling *`, e os listeners no `window`
        // garantem o pan mesmo com o ponteiro fora do `<ol>`.
      }

      event.preventDefault();
      element.scrollLeft = state.startScrollLeft - deltaX;
    };

    const endPan = (event: PointerEvent) => {
      const state = dragState.current;
      if (state.pointerId !== event.pointerId) return;

      document.body.classList.remove("is-grab-scrolling");
      state.isPanning = false;
      state.pointerId = null;
      // `didPan` permanece true até o click de captura consumi-lo abaixo.
    };

    // Captura na fase de captura (antes do onClick do card) para anular o
    // clique que o browser dispara após um pan.
    const suppressClickAfterPan = (event: MouseEvent) => {
      if (dragState.current.didPan) {
        event.preventDefault();
        event.stopPropagation();
        dragState.current.didPan = false;
      }
    };

    // pointerdown e o click de supressão ficam no elemento (gesto começa na
    // board); move/up/cancel ficam no window para receber eventos mesmo com
    // o ponteiro fora do `<ol>` durante o arraste — substitui o pointer
    // capture sem congelar o cursor.
    element.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", endPan);
    window.addEventListener("pointercancel", endPan);
    element.addEventListener("click", suppressClickAfterPan, true);

    return () => {
      element.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", endPan);
      window.removeEventListener("pointercancel", endPan);
      element.removeEventListener("click", suppressClickAfterPan, true);
      document.body.classList.remove("is-grab-scrolling");
    };
  }, [scrollRef, enabled]);
}
