"use client";

/**
 * TTS (Text-to-Speech) — Astro fala de volta.
 *
 * MVP usa Web Speech Synthesis API nativa do browser. Zero custo, pt-BR
 * em qualquer Chromium/Safari/Edge moderno.
 *
 * Upgrade futuro: OpenAI TTS (voz mais natural, cobra em Stars via
 * action `astro_tts_minute`) ou ElevenLabs (premium voz brasileira).
 *
 * Fila simples: chamadas sucessivas enfileiram; user pode interromper
 * com `cancel()`.
 */

let cachedVoices: SpeechSynthesisVoice[] | null = null;
let voicesLoaded = false;

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined") return [];
  const synth = window.speechSynthesis;
  if (!synth) return [];
  const voices = synth.getVoices();
  if (voices.length) {
    cachedVoices = voices;
    voicesLoaded = true;
  }
  return voices;
}

function pickBestVoice(): SpeechSynthesisVoice | null {
  const voices = cachedVoices ?? loadVoices();
  if (!voices.length) return null;

  // Astro é homem JOVIAL e fala português BRASIL puro (sem sotaque
  // português de Portugal). Por isso, dropamos Daniel/Antonio (pt-PT) e
  // Rocko/Grandpa fica como fallback (Rocko soa muito maduro/grave,
  // Grandpa soa idoso).
  //
  // Ordem por percepção: jovial → maduro.
  const malePtBrJovial = [
    /\bReed\b/i, // Apple (pt-BR) — masculino jovem claro [PRIMEIRA ESCOLHA]
    /\bEddy\b/i, // Apple (pt-BR) — neutro pode soar jovial com pitch leve
    /Felipe/i, // Microsoft/Apple — masculino jovem em Windows
    /Diego/i,
    /Ricardo/i,
    /Júlio|Julio/i,
    // Fallbacks "maduros/idosos" — só se nada acima existir
    /\bRocko\b/i,
    /Grandpa/i,
  ];

  // EXIGE pt-BR explícito (não aceita pt-PT pra evitar sotaque português).
  for (const re of malePtBrJovial) {
    const match = voices.find(
      (v) => re.test(v.name) && /pt[-_]?BR/i.test(v.lang),
    );
    if (match) return match;
  }

  // Sem nome reconhecido em pt-BR — pega qualquer pt-BR excluindo femininas
  // conhecidas (já filtra Luciana, Maria, Joana, etc).
  const excludeFemale =
    /Luciana|Maria|Joana|Helena|Catarina|Sandy|Shelley|Grandma|Flo/i;

  const ptBR = voices.filter(
    (v) => /pt[-_]?BR/i.test(v.lang) && !excludeFemale.test(v.name),
  );
  if (ptBR.length > 0) return ptBR[0]!;

  // Último recurso: qualquer pt-BR (mesmo feminino) — melhor falar do que mudo
  const anyPtBR = voices.find((v) => /pt[-_]?BR/i.test(v.lang));
  if (anyPtBR) return anyPtBR;

  // Sem nenhum pt-BR no sistema — desiste com warning silencioso
  return voices.find((v) => /^pt/i.test(v.lang)) ?? voices[0] ?? null;
}

export interface SpeakOptions {
  rate?: number; // 0.5 - 2.0
  pitch?: number; // 0 - 2
  volume?: number; // 0 - 1
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

/**
 * Fala o texto. Best-effort — silencia se browser não suportar ou usuário
 * não tiver interagido ainda (autoplay policy).
 *
 * Garantia: voices async load. Se `onvoiceschanged` ainda não disparou,
 * aguarda 1× antes de tocar.
 */
export function speak(text: string, opts: SpeakOptions = {}): void {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth || !text.trim()) return;

  const utter = new SpeechSynthesisUtterance(stripMarkdownForSpeech(text));
  utter.lang = "pt-BR";
  // Astro é jovial — rate levemente acelerado pra som mais energético,
  // sem ficar apressado. Pitch perto do natural da voz Reed (que já é
  // masculino jovem em pt-BR).
  utter.rate = opts.rate ?? 1.05;
  utter.pitch = opts.pitch ?? 1.0;
  utter.volume = opts.volume ?? 1.0;

  if (opts.onStart) utter.onstart = opts.onStart;
  if (opts.onEnd) utter.onend = opts.onEnd;
  utter.onerror = () => opts.onError?.();

  const tryPlay = () => {
    const voice = pickBestVoice();
    if (voice) utter.voice = voice;
    synth.speak(utter);
  };

  if (voicesLoaded || cachedVoices?.length) {
    tryPlay();
  } else {
    // Voices ainda não carregadas — aguarda 1× e tenta.
    const handler = () => {
      synth.removeEventListener("voiceschanged", handler);
      loadVoices();
      tryPlay();
    };
    synth.addEventListener("voiceschanged", handler);
    // Fallback: timeout 500ms — algumas browsers não disparam o evento
    // mas têm voices populadas após delay.
    setTimeout(() => {
      if (!voicesLoaded) {
        loadVoices();
        if (cachedVoices?.length) {
          synth.removeEventListener("voiceschanged", handler);
          tryPlay();
        }
      }
    }, 500);
  }
}

/** Interrompe a fala atual + esvazia a fila. */
export function cancel(): void {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
}

/** Retorna true se o browser suporta Web Speech Synthesis. */
export function isTtsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

/**
 * Remove sintaxe Markdown comum antes de falar.
 * Mantém o texto natural sem ler "asterisco asterisco" etc.
 */
function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ") // blocos de código
    .replace(/`([^`]+)`/g, "$1") // code inline
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/__([^_]+)__/g, "$1") // bold underline
    .replace(/\*([^*]+)\*/g, "$1") // italic
    .replace(/_([^_]+)_/g, "$1") // italic underline
    .replace(/~~([^~]+)~~/g, "$1") // strike
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1") // images
    .replace(/^#{1,6}\s+/gm, "") // headers
    .replace(/^>\s+/gm, "") // blockquote
    .replace(/^[-*+]\s+/gm, "") // list bullets
    .replace(/^\d+\.\s+/gm, "") // ordered list
    .replace(/\n{2,}/g, ". ") // paragraph breaks
    .replace(/\s+/g, " ")
    .trim();
}
