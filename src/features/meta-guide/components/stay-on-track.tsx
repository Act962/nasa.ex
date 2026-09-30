"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

const META_WINDOW_NAME = "orbita-meta";

/**
 * Abre a Meta numa janela ao lado da ÓRBITA (sempre a mesma), para o cliente
 * ver o passo a passo enquanto clica — em vez de seguir sozinho numa aba cheia.
 */
export function openMetaSideWindow(url: string): boolean {
  const screenWidth = window.screen.availWidth;
  const screenHeight = window.screen.availHeight;
  const width = Math.round(screenWidth * 0.55);
  const features = `popup=yes,width=${width},height=${screenHeight},left=${screenWidth - width},top=0`;
  const metaWindow = window.open(url, META_WINDOW_NAME, features);
  if (!metaWindow) return false;
  metaWindow.focus();
  return true;
}

/** Quando o cliente volta da Meta para a ÓRBITA, destaca o próximo passo por alguns segundos. */
export function useReturnNudge(isArmed: boolean) {
  const [isNudging, setIsNudging] = useState(false);
  useEffect(() => {
    if (!isArmed) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const handleFocus = () => {
      setIsNudging(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setIsNudging(false), 8_000);
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
      clearTimeout(timeout);
    };
  }, [isArmed]);
  return isNudging;
}

const OFF_TRACK_HINTS = [
  "Confira se está no app e no portfólio certos — o botão azul já abre direto neles.",
  "Não clique em botões que o passo não mostra (ex.: Anular tokens, Remover, Excluir, outra conta).",
  "Voltou uma tela sem querer? Use o botão Voltar aqui na ÓRBITA, não o da Meta.",
  "Apareceu um aviso ou pergunta da Meta que não está no print? Não confirme: clique em Pedir ajuda à equipe.",
];

/** Aviso fixo do guia: seguir o passo da ÓRBITA, não o instinto na tela da Meta. */
export function StayOnTrack() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="shrink-0 rounded-md border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs text-sky-900 dark:text-sky-200">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2">
          <Compass className="size-3.5 shrink-0" />
          Na Meta, faça só o que este passo mostra — outros botões podem desfazer o que já foi feito.
        </p>
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="flex shrink-0 items-center gap-1 font-medium underline-offset-2 hover:underline"
        >
          Minha tela está diferente
          <ChevronDown className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} />
        </button>
      </div>
      {isOpen && (
        <ul className="animate-in fade-in slide-in-from-top-1 mt-2 list-disc space-y-1 pl-5">
          {OFF_TRACK_HINTS.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
