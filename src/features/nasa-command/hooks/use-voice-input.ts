import { useState, useRef, useCallback } from "react";
import { VoiceState } from "../types";

export function useVoiceInput(onTranscript: (text: string) => void) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const voiceStateRef = useRef<VoiceState>("idle");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const setVoice = (s: VoiceState) => {
    voiceStateRef.current = s;
    setVoiceState(s);
  };

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setVoice("unsupported");
      return;
    }
    if (voiceStateRef.current === "listening") {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognitionAPI =
      (
        window as unknown as {
          SpeechRecognition?: typeof SpeechRecognition;
          webkitSpeechRecognition?: typeof SpeechRecognition;
        }
      ).SpeechRecognition ??
      (
        window as unknown as {
          webkitSpeechRecognition?: typeof SpeechRecognition;
        }
      ).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => setVoice("listening");

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setVoice("processing");
      if (transcript.trim()) {
        onTranscript(transcript.trim());
      }
      setTimeout(() => setVoice("idle"), 400);
    };

    recognition.onerror = () => setVoice("idle");
    recognition.onend = () => {
      // Só reseta se não houve resultado (onresult já gerencia o estado)
      if (voiceStateRef.current === "listening") setVoice("idle");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, onTranscript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setVoice("idle");
  }, []);

  return { voiceState, startListening, stopListening, isSupported };
}
