"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useAstroOrbStore } from "./use-astro-orb-store";
import { useAstroWidgetStore } from "./use-astro-widget-store";
import { useVoiceModeStore } from "./use-voice-mode-store";
import { speak } from "./tts";
import { buildGreeting, extractFirstName } from "./greeting";

/**
 * Ações de voz do Astro, usadas pelo orb, pelo menu de voz e pelo campo do
 * painel (spec 0015). Não liga a escuta contínua da wake word — esse loop mora
 * só no orb, pra nunca rodar duas vezes.
 *
 * Para onde vai a fala capturada: com o painel aberto fora do /home, ela entra
 * no painel. Senão, segue para o /home como antes (`?prompt=`).
 */

const CAPTURE_TIMEOUT_MS = 8000;
const HINT_CLEAR_DELAY_MS = 2500;
const WAKE_WORD_HINT_DELAY_MS = 3500;

export function useAstroVoiceActions() {
  const wakeWordEnabled = useAstroOrbStore((state) => state.wakeWordEnabled);
  const setPhase = useAstroOrbStore((state) => state.setPhase);
  const setHint = useAstroOrbStore((state) => state.setHint);
  const setPendingUtterance = useAstroOrbStore((state) => state.setPendingUtterance);
  const setWakeWordEnabled = useAstroOrbStore((state) => state.setWakeWordEnabled);
  const setMicGuideOpen = useAstroOrbStore((state) => state.setMicGuideOpen);
  const setVoiceSpeaking = useVoiceModeStore((state) => state.setSpeaking);

  const router = useRouter();
  const pathname = usePathname();

  // Saudação proativa: precisa do primeiro nome do usuário pra falar
  // "Opa Wey…" quando o wake word dispara.
  const { data: session } = authClient.useSession();
  const firstName = extractFirstName(session?.user?.name);

  // Captura utterance — quando triggerada por wake word, fala uma saudação
  // proativa antes ("Opa Wey, como posso ajudar?"). Quando triggerada por
  // clique manual, pula direto pra escuta.
  const captureUtterance = useCallback(
    (options: { withGreeting?: boolean } = {}) => {
      if (typeof window === "undefined") return;
      const RecognitionConstructor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
      if (!RecognitionConstructor) return;

      const deliverTranscript = (transcriptText: string) => {
        setPhase("thinking");
        setHint(`"${transcriptText}"`);
        const widget = useAstroWidgetStore.getState();
        if (pathname !== "/home" && widget.isOpen) {
          widget.open({ text: transcriptText, fromVoice: true });
          return;
        }
        setPendingUtterance(transcriptText);
        if (pathname !== "/home") {
          router.push(`/home?prompt=${encodeURIComponent(transcriptText)}`);
        }
      };

      const runRecognition = () => {
        const recognition = new RecognitionConstructor();
        recognition.lang = "pt-BR";
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        let capturedTranscript = "";
        let isResolved = false;

        const resolve = (text: string) => {
          if (isResolved) return;
          isResolved = true;
          try {
            recognition.stop();
          } catch {
            /* já tinha parado */
          }
          const transcriptText = text.trim();
          if (transcriptText) {
            deliverTranscript(transcriptText);
          } else {
            setPhase("idle");
            setHint(null);
          }
          setTimeout(() => setHint(null), HINT_CLEAR_DELAY_MS);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const lastResult = event.results[event.results.length - 1];
          capturedTranscript = lastResult?.[0]?.transcript ?? "";
        };
        recognition.onerror = () => resolve(capturedTranscript);
        recognition.onend = () => resolve(capturedTranscript);

        try {
          recognition.start();
        } catch {
          resolve("");
        }

        // Fecha mesmo se o reconhecimento não disparar `end`.
        setTimeout(() => {
          try {
            recognition.stop();
          } catch {
            /* já tinha parado */
          }
          resolve(capturedTranscript);
        }, CAPTURE_TIMEOUT_MS);
      };

      const startCapture = () => {
        setPhase("listening");
        setHint("Te ouvindo…");
        runRecognition();
      };

      if (options.withGreeting) {
        const greeting = buildGreeting(firstName);
        setPhase("speaking");
        setHint(greeting);
        setVoiceSpeaking(true);
        speak(greeting, {
          onEnd: () => {
            setVoiceSpeaking(false);
            startCapture();
          },
          onError: () => {
            setVoiceSpeaking(false);
            startCapture();
          },
        });
        return;
      }

      startCapture();
    },
    [pathname, router, setPhase, setHint, setPendingUtterance, setVoiceSpeaking, firstName],
  );

  const toggleWakeWord = useCallback(async () => {
    if (wakeWordEnabled) {
      setWakeWordEnabled(false);
      return;
    }

    // Pre-check via Permissions API (Chrome/Edge têm; Safari não).
    let permissionState: PermissionState | null = null;
    try {
      if (navigator.permissions) {
        const permissionStatus = await navigator.permissions.query({
          // 'microphone' não consta no PermissionName padrão em alguns lib.dom,
          // mas é amplamente suportado (Chrome/Edge/Firefox).
          name: "microphone" as PermissionName,
        });
        permissionState = permissionStatus.state;
      }
    } catch {
      // Sem Permissions API: o getUserMedia abaixo pede a permissão.
    }

    // Já negado não adianta tentar — o guia explica como liberar.
    if (permissionState === "denied") {
      setMicGuideOpen(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Só queríamos a permissão: solta o microfone na hora.
      stream.getTracks().forEach((track) => track.stop());
      setWakeWordEnabled(true);
      setHint("Escuta ativada — diga 'ASTRO' pra eu te ouvir");
      setTimeout(() => setHint(null), WAKE_WORD_HINT_DELAY_MS);
    } catch (permissionError) {
      // NotAllowedError = usuário negou agora; SecurityError = contexto não-seguro.
      console.warn("[astro-voice] permissão de microfone falhou:", permissionError);
      setMicGuideOpen(true);
    }
  }, [wakeWordEnabled, setWakeWordEnabled, setMicGuideOpen, setHint]);

  return { captureUtterance, toggleWakeWord };
}
