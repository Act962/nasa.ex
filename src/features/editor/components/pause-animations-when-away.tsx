"use client";

import { useEffect } from "react";

// As animações do editor de fluxos só rodam na página que a pessoa está olhando. Aba em segundo
// plano ou janela sem foco ficam com tudo parado, para não gastar processador à toa.

const PAUSED_BODY_CLASS = "orbita-flow-paused";

const PAUSE_STYLES = `
body.${PAUSED_BODY_CLASS} .orbita-outline-rect,
body.${PAUSED_BODY_CLASS} .react-flow__edge-path,
body.${PAUSED_BODY_CLASS} .orbita-add-next-pulse { animation-play-state: paused !important; }
`;

export function PauseAnimationsWhenAway() {
  useEffect(() => {
    const syncPausedState = () => {
      const isAway = document.visibilityState !== "visible" || !document.hasFocus();
      document.body.classList.toggle(PAUSED_BODY_CLASS, isAway);
    };
    syncPausedState();
    document.addEventListener("visibilitychange", syncPausedState);
    window.addEventListener("focus", syncPausedState);
    window.addEventListener("blur", syncPausedState);
    return () => {
      document.removeEventListener("visibilitychange", syncPausedState);
      window.removeEventListener("focus", syncPausedState);
      window.removeEventListener("blur", syncPausedState);
      document.body.classList.remove(PAUSED_BODY_CLASS);
    };
  }, []);
  return <style>{PAUSE_STYLES}</style>;
}
