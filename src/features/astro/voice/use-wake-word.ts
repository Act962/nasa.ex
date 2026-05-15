"use client";

import { useEffect, useRef } from "react";

/**
 * Wake word detection — escuta passivamente o microfone e dispara
 * `onWake()` quando a palavra-chave (default "astro") aparece no
 * transcript interim do STT.
 *
 * Stack: Web Speech API com `continuous: true` + `interimResults: true`.
 * Roda em loop infinito — se `onend` disparar (acontece em alguns browsers
 * a cada 60s), reinicia automaticamente.
 *
 * Privacy first:
 *  - Opt-in obrigatório via `enabled` prop (user precisa ativar explicitamente).
 *  - Pausa enquanto `paused=true` (ex: TTS falando — não captura a própria voz
 *    do Astro como wake word).
 *  - Não envia áudio nem transcript pra server até wake word disparar.
 *
 * Normalização: remove acentos + lowercase + trim antes de comparar.
 *
 * Limitações conhecidas:
 *  - Web Speech API em Safari é instável (frequentes desconexões).
 *  - Falsos positivos quando a palavra "astro" aparece em outra conversa.
 *    Mitigado por: (1) onWake fecha o wake word loop até `enabled` ser
 *    re-ligado pelo orb depois do utterance, (2) feedback visual permanente
 *    quando ativo.
 *  - Upgrade futuro: Porcupine WASM (free tier 1k usuários/mês, mais robusto).
 */

const DEFAULT_KEYWORDS = ["astro"] as const;

export interface UseWakeWordOptions {
  enabled: boolean;
  paused?: boolean;
  keywords?: readonly string[];
  onWake: () => void;
  onError?: (err: string) => void;
  /** Idioma do STT — default pt-BR. */
  lang?: string;
}

export function useWakeWord({
  enabled,
  paused = false,
  keywords = DEFAULT_KEYWORDS,
  onWake,
  onError,
  lang = "pt-BR",
}: UseWakeWordOptions) {
  // Refs pra não recriar SR quando callbacks mudam
  const recRef = useRef<SpeechRecognition | null>(null);
  const stoppedManuallyRef = useRef(false);
  const onWakeRef = useRef(onWake);
  const onErrorRef = useRef(onError);
  const keywordsRef = useRef(keywords);

  useEffect(() => {
    onWakeRef.current = onWake;
  }, [onWake]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    keywordsRef.current = keywords;
  }, [keywords]);

  useEffect(() => {
    if (!enabled || paused) {
      // cleanup do ciclo atual
      stoppedManuallyRef.current = true;
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
      recRef.current = null;
      return;
    }

    if (typeof window === "undefined") return;
    const SRApi = (
      window as unknown as {
        SpeechRecognition?: typeof SpeechRecognition;
        webkitSpeechRecognition?: typeof SpeechRecognition;
      }
    );
    const SR = SRApi.SpeechRecognition ?? SRApi.webkitSpeechRecognition;
    if (!SR) {
      onErrorRef.current?.("SpeechRecognition não suportado neste browser");
      return;
    }

    stoppedManuallyRef.current = false;

    const start = () => {
      if (stoppedManuallyRef.current) return;
      try {
        const rec = new SR();
        rec.lang = lang;
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 1;

        rec.onresult = (event: SpeechRecognitionEvent) => {
          const results = event.results;
          // Itera resultados ainda não finalizados pra resposta mais rápida.
          // results.length-1 é o mais recente; verificamos só o último.
          const lastResult = results[results.length - 1];
          if (!lastResult) return;
          const raw = lastResult[0]?.transcript ?? "";
          if (matchesKeyword(raw, keywordsRef.current)) {
            // Para o loop — quem chama (orb) re-liga depois do utterance.
            stoppedManuallyRef.current = true;
            try {
              rec.stop();
            } catch {
              /* ignore */
            }
            onWakeRef.current();
          }
        };

        rec.onerror = (e: Event & { error?: string }) => {
          // "no-speech" é comum quando o ambiente está silencioso —
          // não emite ao caller, só reinicia se ainda enabled.
          if (e.error && e.error !== "no-speech" && e.error !== "aborted") {
            onErrorRef.current?.(e.error);
          }
        };

        rec.onend = () => {
          if (!stoppedManuallyRef.current) {
            // Reinicia em 200ms — browsers desconectam continuous mode
            // periodicamente. Backoff mínimo evita spam.
            setTimeout(start, 200);
          }
        };

        recRef.current = rec;
        rec.start();
      } catch (err) {
        // Já tem uma sessão ativa ou erro de permissão — silencioso, tenta de novo.
        if (err instanceof Error) {
          onErrorRef.current?.(err.message);
        }
      }
    };

    start();

    return () => {
      stoppedManuallyRef.current = true;
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    };
  }, [enabled, paused, lang]);
}

/** Normaliza string + bate contra qualquer keyword. */
function matchesKeyword(
  transcript: string,
  keywords: readonly string[],
): boolean {
  const norm = transcript
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  return keywords.some((kw) => {
    const k = kw
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
    // Match palavra inteira (com word boundary aproximado) — evita match em
    // "astronaut", "astronomico", etc. Mas aceita "Astro," "Astro!" etc.
    const re = new RegExp(`(^|[^a-z0-9])${k}([^a-z0-9]|$)`, "i");
    return re.test(norm);
  });
}
