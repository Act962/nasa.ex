"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command as CmdIcon, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SlashComposer } from "./slash-composer";
import { useAstroOrbStore } from "@/features/astro/voice/use-astro-orb-store";
import { useVoiceModeStore } from "@/features/astro/voice/use-voice-mode-store";

/**
 * Cmd+K Palette — composer global, acessível de QUALQUER página.
 *
 * Atalho: Ctrl/Cmd + K. Reusa <SlashComposer/> dentro de um Dialog.
 *
 * Submit:
 *   1. Marca a entrada como digitada (não voz) pra TTS não narrar
 *   2. Seta pendingUtterance no store do orb
 *   3. Navega pra /home — NasaCommandCenter consome o pending e auto-submete
 *      no useEffect existente (mesma mecânica do wake word)
 *   4. Fecha o palette
 *
 * Reuso: ZERO código duplicado. Mesmo composer, mesmo pipeline, mesma
 * cobrança Stars. Cmd+K vira só uma "porta de entrada" extra.
 */
export function CmdkPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const setPendingUtterance = useAstroOrbStore((s) => s.setPendingUtterance);
  const setOrbPhase = useAstroOrbStore((s) => s.setPhase);
  const setLastInputWasVoice = useVoiceModeStore(
    (s) => s.setLastInputWasVoice,
  );

  // Captura Ctrl/Cmd+K global.
  // Não conflitar com inputs — se user tem foco em <input> ou <textarea>,
  // o atalho ainda funciona (pattern Linear/Notion). Só pula quando user
  // tá digitando em um contenteditable.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.key.toLowerCase() !== "k") return;
      // Permite Ctrl+Shift+K e similares passarem
      if (e.altKey) return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSubmit = useCallback(
    (prompt: string) => {
      // Marca explicitamente que foi DIGITAÇÃO (não voz) — Astro responde
      // em texto, não chama TTS (a menos que user esteja em modo "audio" sempre).
      setLastInputWasVoice(false);
      // Envia via mesma porta do wake word: pendingUtterance + nav /home.
      setPendingUtterance(prompt);
      setOrbPhase("thinking");
      router.push("/home");
      setOpen(false);
    },
    [router, setPendingUtterance, setOrbPhase, setLastInputWasVoice],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 bg-zinc-950 border-zinc-800">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-sm text-zinc-200 flex items-center gap-2">
            <Sparkles className="size-3.5 text-violet-400" />
            Comando rápido
          </DialogTitle>
          <DialogDescription className="sr-only">
            Monte um comando escolhendo verbo, app e campos. Submit envia ao Astro.
          </DialogDescription>
        </DialogHeader>
        <div className="px-3 pb-3">
          <SlashComposer onSubmit={handleSubmit} />
          <p className="mt-2 text-[10px] text-zinc-600 text-center">
            <kbd className="px-1 py-0.5 rounded bg-zinc-900 border border-zinc-800">
              <CmdIcon className="inline size-2.5" />K
            </kbd>{" "}
            abre e fecha •{" "}
            <kbd className="px-1 py-0.5 rounded bg-zinc-900 border border-zinc-800">
              Esc
            </kbd>{" "}
            cancela
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
