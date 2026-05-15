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
  // Ordem por percepção CONVERSACIONAL:
  //   Eddy = neutro expressivo, ótimo pra fala natural casual
  //   Reed = jovem claro, levemente formal
  //   Eddy fica em primeiro porque tem prosódia mais natural em frases
  //   conversacionais; Reed soa "lendo" às vezes.
  const malePtBrJovial = [
    /\bEddy\b/i, // Apple (pt-BR) — neutro expressivo conversacional [PRIMEIRA]
    /\bReed\b/i, // Apple (pt-BR) — masculino jovem claro
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

  const processedText = humanizeForSpeech(stripMarkdownForSpeech(text));

  // Quebra em sentenças e enfileira cada uma como utterance separada com
  // micro-pausa entre. Isso reproduz prosódia natural de fala humana
  // (respiro entre frases) muito melhor que uma utterance única longa,
  // que costuma ter ritmo "leitura mecânica".
  const sentences = splitIntoSentences(processedText);
  if (sentences.length === 0) return;

  // Rate moderado conversacional: 0.97 = levemente desacelerado pra
  // pausas e flow natural; 1.05 soava apressado/robotizado.
  const rate = opts.rate ?? 0.97;
  // Pitch 0.95 (era 1.0) — levemente mais grave, transmite calma e
  // confiança. Web Speech compensa internamente sem soar processado.
  const pitch = opts.pitch ?? 0.95;
  const volume = opts.volume ?? 1.0;

  /**
   * Pausa entre sentenças em ms. Web Speech enfileira utterances com
   * gap nativo ~50ms — muito apertado pra parecer respiração. 350ms
   * dá tempo de "respirar" mas sem soar arrastado.
   */
  const SENTENCE_PAUSE_MS = 350;

  const playQueue = () => {
    const voice = pickBestVoice();
    let started = false;

    // Encadeia sequencialmente: speak → onend → setTimeout(pause) → next.
    // Isso dá pausa REAL controlável entre frases, em vez do gap nativo
    // mínimo do .speak() chamado em loop.
    let i = 0;
    const speakNext = () => {
      if (i >= sentences.length) {
        opts.onEnd?.();
        return;
      }
      const sentence = sentences[i]!;
      const isFirst = i === 0;
      const isLast = i === sentences.length - 1;
      i++;

      const utter = new SpeechSynthesisUtterance(sentence);
      utter.lang = "pt-BR";
      utter.rate = rate;
      utter.pitch = pitch;
      utter.volume = volume;
      if (voice) utter.voice = voice;

      if (isFirst && opts.onStart) {
        utter.onstart = () => {
          if (!started) {
            started = true;
            opts.onStart?.();
          }
        };
      }

      utter.onend = () => {
        if (isLast) {
          opts.onEnd?.();
        } else {
          setTimeout(speakNext, SENTENCE_PAUSE_MS);
        }
      };
      utter.onerror = () => {
        opts.onError?.();
        // Mesmo com erro, tenta próxima — não trava a fila inteira
        if (!isLast) setTimeout(speakNext, SENTENCE_PAUSE_MS);
      };

      synth.speak(utter);
    };
    speakNext();
  };

  if (voicesLoaded || cachedVoices?.length) {
    playQueue();
  } else {
    const handler = () => {
      synth.removeEventListener("voiceschanged", handler);
      loadVoices();
      playQueue();
    };
    synth.addEventListener("voiceschanged", handler);
    setTimeout(() => {
      if (!voicesLoaded) {
        loadVoices();
        if (cachedVoices?.length) {
          synth.removeEventListener("voiceschanged", handler);
          playQueue();
        }
      }
    }, 500);
  }
}

/**
 * Quebra texto em sentenças aproveitando ponto/exclamação/interrogação.
 * Mantém os terminadores na sentença pra Web Speech respeitar entonação.
 * Cap em ~140 chars por sentença — sentenças muito longas comem o ritmo
 * (Web Speech tende a "correr"). Quando exceder, quebra em vírgula natural.
 */
function splitIntoSentences(text: string): string[] {
  if (!text.trim()) return [];
  // Primeiro split por terminadores fortes (?! .)
  const rough = text
    .split(/([.!?]+)\s+/)
    .reduce<string[]>((acc, chunk, i, arr) => {
      // Junta cada chunk com o terminador que vem depois
      if (/^[.!?]+$/.test(chunk)) {
        const prev = acc.pop() ?? "";
        acc.push((prev + chunk).trim());
      } else if (chunk.trim()) {
        acc.push(chunk.trim());
      }
      void arr;
      void i;
      return acc;
    }, []);

  // Quebra adicional em vírgulas pra sentenças longas (>140 chars)
  const final: string[] = [];
  for (const s of rough) {
    if (s.length <= 140) {
      final.push(s);
      continue;
    }
    // Tenta dividir em vírgula no meio
    const commaParts = s.split(/,\s+/);
    let buffer = "";
    for (const part of commaParts) {
      if ((buffer + part).length > 140 && buffer) {
        final.push(buffer.trim() + ",");
        buffer = part;
      } else {
        buffer = buffer ? `${buffer}, ${part}` : part;
      }
    }
    if (buffer.trim()) final.push(buffer.trim());
  }
  return final.filter((s) => s.trim().length > 0);
}

/**
 * Injeta pausas naturais de fala brasileira via pontuação estratégica.
 * Não inventa palavras — só ajuda Web Speech a respeitar pausas que
 * fariam falta num discurso natural pt-BR.
 */
function humanizeForSpeech(text: string): string {
  return (
    text
      // "Opa Weydson" → "Opa, Weydson" (vocativo brasileiro pede vírgula)
      .replace(
        /^(opa|olha|beleza|escuta|cara|amigo|mano|gente|po|nossa|caraca)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç])/i,
        "$1, $2",
      )
      // Conjunções no meio sem vírgula → adiciona pausa
      .replace(
        /\s+(mas|porém|então|aliás|enfim|inclusive|tipo)\s+/gi,
        ", $1, ",
      )
      // Reticências viram pausa mais longa via duplo ponto
      .replace(/\.{3,}/g, ".. ")
      // Hífen no meio de frase vira pausa pequena (vírgula)
      .replace(/(\w)\s*[—–-]\s*(\w)/g, "$1, $2")
      // Espaços múltiplos → 1 só
      .replace(/\s+/g, " ")
      .trim()
  );
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
