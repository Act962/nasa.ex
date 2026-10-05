"use client";

import { useSyncExternalStore } from "react";
import { Maximize2Icon, Minimize2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Um botão só, no computador: azul (Expandir) fora da tela cheia, vermelho (Retrair) dentro dela. */

function subscribeToFullscreen(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

const readIsFullscreen = () => Boolean(document.fullscreenElement);
const readIsSupported = () => typeof document.documentElement.requestFullscreen === "function";
const readOnServer = () => false;

/** Vai no fim da barra de cima de cada App, depois do último ícone, para nunca cobrir nada. */
export function FullscreenControls({ className }: { className?: string }) {
  const isSupported = useSyncExternalStore(subscribeToFullscreen, readIsSupported, readOnServer);
  const isFullscreen = useSyncExternalStore(subscribeToFullscreen, readIsFullscreen, readOnServer);


  if (!isSupported) return null;

  const expand = () => {
    document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {
      // Navegador recusou: segue na janela normal.
    });
  };

  const retract = () => {
    document.exitFullscreen().catch(() => {
      // Já tinha saído (Esc): nada a fazer.
    });
  };

  return (
    <button
      type="button"
      onClick={isFullscreen ? retract : expand}
      aria-label={isFullscreen ? "Retrair (sair da tela cheia)" : "Expandir (tela cheia)"}
      title={isFullscreen ? "Retrair" : "Expandir"}
      className={cn(
        "hidden size-6 shrink-0 place-items-center rounded-full text-white shadow-sm transition-[background-color,transform] duration-200 hover:scale-110 active:scale-95 [@media(pointer:fine)]:lg:grid [&_svg]:size-3",
        isFullscreen ? "bg-destructive" : "bg-info",
        className,
      )}
    >
      {isFullscreen ? <Minimize2Icon strokeWidth={2.75} /> : <Maximize2Icon strokeWidth={2.75} />}
    </button>
  );
}
