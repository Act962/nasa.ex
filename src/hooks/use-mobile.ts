import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const TINY_MOBILE_BREAKPOINT = 380;
// Tablets entram até 1024px (mesmo breakpoint `lg` do Tailwind). Páginas
// que ficam apertadas em layouts de 2 colunas (ex: /tracking-chat) usam
// `useIsMobileOrTablet` pra mostrar a versão "smartphone-like" (1 painel
// só) em qualquer tela <lg.
const TABLET_BREAKPOINT = 1024;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

/**
 * True quando a viewport é <1024px (mobile OU tablet). Diferente de
 * `useIsMobile` (<768px) — usado em páginas que devem tratar tablet
 * com mesma UX de smartphone (1 painel por vez ao invés de 2 colunas).
 */
export function useIsMobileOrTablet() {
  const [match, setMatch] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${TABLET_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setMatch(window.innerWidth < TABLET_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setMatch(window.innerWidth < TABLET_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!match;
}

export function useIsTinyMobile() {
  const [isTiny, setIsTiny] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${TINY_MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsTiny(window.innerWidth < TINY_MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsTiny(window.innerWidth < TINY_MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isTiny;
}
