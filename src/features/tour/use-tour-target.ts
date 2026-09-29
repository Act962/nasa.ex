"use client";

import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 150;
const MISSING_AFTER_MS = 5000;

export interface TourTarget {
  rect: DOMRect | null;
  element: Element | null;
  isMissing: boolean;
  /** Campo de texto do alvo tem conteúdo — libera o "Continuar" do passo `input`. */
  isInputFilled: boolean;
}

const EMPTY_TARGET: TourTarget = { rect: null, element: null, isMissing: false, isInputFilled: false };

// O Switch do Radix gera um checkbox escondido dentro de formulários; ele não é o campo.
const TEXT_FIELD_SELECTOR =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([aria-hidden="true"]), textarea';

function readInputValue(element: Element): string {
  const field =
    element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
      ? element
      : element.querySelector<HTMLInputElement | HTMLTextAreaElement>(TEXT_FIELD_SELECTOR);
  return field?.value ?? "";
}

function isSameRect(previous: DOMRect | null, next: DOMRect): boolean {
  return (
    previous !== null &&
    previous.top === next.top &&
    previous.left === next.left &&
    previous.width === next.width &&
    previous.height === next.height
  );
}

// Consulta periódica em vez de eventos: Sheets animam, boards rolam e modais
// montam depois do clique — nenhum evento único cobre tudo isso.
export function useTourTarget(selector: string | null, stepKey: string): TourTarget {
  const [target, setTarget] = useState<TourTarget>(EMPTY_TARGET);

  useEffect(() => {
    setTarget(EMPTY_TARGET);
    if (!selector) return;

    const startedAt = Date.now();
    let hasScrolledIntoView = false;

    const update = () => {
      const element = document.querySelector(selector);
      if (!element) {
        const isMissing = Date.now() - startedAt > MISSING_AFTER_MS;
        setTarget((previous) =>
          previous.element === null && previous.isMissing === isMissing
            ? previous
            : { ...EMPTY_TARGET, isMissing },
        );
        return;
      }

      if (!hasScrolledIntoView) {
        hasScrolledIntoView = true;
        const initialRect = element.getBoundingClientRect();
        const isOutOfView = initialRect.bottom < 0 || initialRect.top > window.innerHeight;
        if (isOutOfView) element.scrollIntoView({ block: "center", behavior: "smooth" });
      }

      const rect = element.getBoundingClientRect();
      const isInputFilled = readInputValue(element).trim().length > 0;
      setTarget((previous) =>
        previous.element === element && isSameRect(previous.rect, rect) && previous.isInputFilled === isInputFilled
          ? previous
          : { rect, element, isMissing: false, isInputFilled },
      );
    };

    update();
    const intervalId = window.setInterval(update, POLL_INTERVAL_MS);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [selector, stepKey]);

  return target;
}
