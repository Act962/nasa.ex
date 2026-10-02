"use client";

import { useEffect, useState } from "react";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuideTermsText } from "./guide-terms-text";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  "Confira se está na conexão e no portfólio certos — o botão azul já abre direto neles.",
  "Não clique em botões que o passo não mostra (ex.: Anular tokens, Remover, Excluir, outra conta).",
  "Voltou uma tela sem querer? Use o botão Voltar aqui na ÓRBITA, não o da Meta.",
  "Apareceu um aviso ou pergunta da Meta que não está no print? Não confirme: clique em Pedir ajuda à equipe.",
];

const STAY_ON_TRACK_SEEN_KEY = "meta-guide:stay-on-track-seen";

export function hasSeenStayOnTrack(): boolean {
  try {
    return window.localStorage.getItem(STAY_ON_TRACK_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markStayOnTrackSeen() {
  try {
    window.localStorage.setItem(STAY_ON_TRACK_SEEN_KEY, "1");
  } catch {
    // Sem armazenamento (aba anônima): o aviso só volta a aparecer numa próxima visita.
  }
}

/** Aviso do guia em popup, uma vez só: seguir o passo da ÓRBITA, não o instinto na tela da Meta. */
export function StayOnTrackDialog({ open, onConfirm }: { open: boolean; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onConfirm()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] gap-6 px-6 pt-7 pb-6 sm:max-w-md" showCloseButton={false}>
        <DialogHeader className="items-center gap-3 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-info/15 text-info">
            <Compass className="size-7" />
          </span>
          <DialogTitle className="text-lg">Faça só o que cada passo mostra</DialogTitle>
          <DialogDescription className="text-[15px] leading-relaxed text-muted-foreground">
            Outros botões da Meta podem desfazer o que já foi feito. Se a sua tela estiver diferente do print:
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {OFF_TRACK_HINTS.map((hint) => (
            <li key={hint} className="flex items-start gap-2 rounded-[14px] bg-muted/60 p-2.5 text-sm">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-info" />
              <span>
                <GuideTermsText text={hint} />
              </span>
            </li>
          ))}
        </ul>
        <Button className="h-12 w-full rounded-full text-[15px]" onClick={onConfirm}>
          Entendi
        </Button>
      </DialogContent>
    </Dialog>
  );
}
