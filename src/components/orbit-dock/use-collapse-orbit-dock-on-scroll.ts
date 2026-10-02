"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useOrbitDockStore } from "./orbit-dock-store";

/** Rolar para baixo recolhe o dock; voltar perto do topo (ou trocar de tela) abre de novo. */

const NEAR_TOP_PX = 80;
const MIN_SCROLL_DELTA_PX = 6;

function readScrollTop(target: EventTarget | null): { element: object; scrollTop: number } | null {
  if (target === document || target === document.documentElement || target === document.body) {
    return { element: document, scrollTop: window.scrollY };
  }
  if (!(target instanceof HTMLElement)) return null;
  // Listas pequenas (menus, selects) rolando não mexem no dock: só a área principal da tela.
  if (target.clientHeight < window.innerHeight * 0.5) return null;
  return { element: target, scrollTop: target.scrollTop };
}

export function useCollapseOrbitDockOnScroll(isDisabled: boolean) {
  const pathname = usePathname();
  const setIsCollapsed = useOrbitDockStore((state) => state.setIsCollapsed);

  useEffect(() => {
    setIsCollapsed(false);
  }, [pathname, setIsCollapsed]);

  useEffect(() => {
    if (isDisabled) return;
    const lastScrollTopByElement = new WeakMap<object, number>();

    const handleScroll = (event: Event) => {
      const scrolled = readScrollTop(event.target);
      if (!scrolled) return;
      const lastScrollTop = lastScrollTopByElement.get(scrolled.element) ?? 0;
      lastScrollTopByElement.set(scrolled.element, scrolled.scrollTop);

      if (scrolled.scrollTop <= NEAR_TOP_PX) {
        setIsCollapsed(false);
        return;
      }
      if (scrolled.scrollTop - lastScrollTop > MIN_SCROLL_DELTA_PX) setIsCollapsed(true);
    };

    // Captura: pega a rolagem de qualquer área (a página, o canvas do construtor, listas longas).
    document.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("scroll", handleScroll, { capture: true });
      setIsCollapsed(false);
    };
  }, [isDisabled, setIsCollapsed]);
}
