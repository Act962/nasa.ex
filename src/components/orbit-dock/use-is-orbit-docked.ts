"use client";

import { useSyncExternalStore } from "react";

/** Verdadeiro quando o dock em órbita está na tela (celular, App com dock montado). */

const DOCKED_MEDIA_QUERY = "(max-width: 1023.98px)";

function readIsDocked() {
  return (
    document.documentElement.dataset.orbitDock === "" &&
    window.matchMedia(DOCKED_MEDIA_QUERY).matches
  );
}

function readIsDockHidden() {
  return (
    document.documentElement.dataset.orbitDock === "hidden" &&
    window.matchMedia(DOCKED_MEDIA_QUERY).matches
  );
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-orbit-dock", "data-orbit-dock-center"] });
  const mediaQuery = window.matchMedia(DOCKED_MEDIA_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    mediaQuery.removeEventListener("change", onChange);
  };
}

function readIsCenterTaken() {
  return (
    document.documentElement.dataset.orbitDockCenter === "custom" &&
    window.matchMedia(DOCKED_MEDIA_QUERY).matches
  );
}

/** Verdadeiro quando a tela pôs a própria ação no centro do dock; o orb do ASTRO sai do caminho. */
export function useIsOrbitCenterTaken() {
  return useSyncExternalStore(subscribe, readIsCenterTaken, () => false);
}

export function useIsOrbitDocked() {
  return useSyncExternalStore(subscribe, readIsDocked, () => false);
}

/** Verdadeiro quando a tela pediu para esconder o dock no celular; o orb some junto. */
export function useIsOrbitDockHidden() {
  return useSyncExternalStore(subscribe, readIsDockHidden, () => false);
}
