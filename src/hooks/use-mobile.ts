import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const TINY_MOBILE_BREAKPOINT = 380;

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
