"use client";

import { useEffect } from "react";

// Painel lateral de edição (spec 0090, seção E): com o interruptor ligado, a configuração do quadro
// abre encostada na direita, deixando o fluxo à vista, em vez de uma janela por cima. As janelas de
// cada quadro não mudam por dentro: só ganham a marca `data-node-config`, e este estilo as reposiciona.

const INSPECTOR_BODY_CLASS = "orbita-workflow-inspector";

export const IS_WORKFLOW_INSPECTOR_ON = process.env.NEXT_PUBLIC_WORKFLOW_INSPECTOR === "true";

const INSPECTOR_STYLES = `
@media (min-width: 768px) {
  body.${INSPECTOR_BODY_CLASS} [data-node-config] {
    position: fixed !important;
    top: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    left: auto !important;
    translate: none !important;
    transform: none !important;
    width: min(460px, 100vw) !important;
    max-width: none !important;
    height: 100dvh !important;
    max-height: none !important;
    border-radius: 0 !important;
    border-width: 0 0 0 1px !important;
    overflow-y: auto !important;
    align-content: start;
  }
  body.${INSPECTOR_BODY_CLASS} [data-node-config][data-state="open"] {
    animation: orbita-inspector-in .18s ease-out !important;
  }
  body.${INSPECTOR_BODY_CLASS} [data-node-config][data-state="closed"] {
    animation: none !important;
  }
  body.${INSPECTOR_BODY_CLASS} [data-slot="dialog-overlay"]:has(+ [data-node-config]) {
    background: transparent !important;
    backdrop-filter: none !important;
  }
}
@keyframes orbita-inspector-in { from { translate: 24px 0; opacity: 0; } to { translate: 0 0; opacity: 1; } }
`;

export function InspectorMode() {
  useEffect(() => {
    if (!IS_WORKFLOW_INSPECTOR_ON) return;
    document.body.classList.add(INSPECTOR_BODY_CLASS);
    return () => document.body.classList.remove(INSPECTOR_BODY_CLASS);
  }, []);
  if (!IS_WORKFLOW_INSPECTOR_ON) return null;
  return <style>{INSPECTOR_STYLES}</style>;
}
