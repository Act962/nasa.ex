"use client";

/**
 * TTS (Text-to-Speech) — Astro fala de volta.
 *
 * 2 engines:
 *   1) Piper TTS (preferido se NEXT_PUBLIC_PIPER_ENABLED=true E o
 *      endpoint /api/astro/tts responde) — voz VITS pt-BR Faber, muito
 *      mais natural. Roda em container Docker local; ver PIPER_SETUP.md.
 *   2) Web Speech Synthesis (fallback automático sempre que Piper falha
 *      ou não está habilitado).
 *
 * Fila e interrupção via cancel() funcionam pros dois engines.
 *
 * 🚨 DEV / PROD CHECKLIST:
 *
 * Pra Piper funcionar em produção (voz oficial Faber):
 *   1. Container Piper rodando + acessível pelo Next.js. Ver
 *      docker/piper/PIPER_SETUP.md (subir local) ou DEPLOYMENT.md
 *      §4 (Fly.io / VPS / mesmo host).
 *   2. Env vars no host do app:
 *        NEXT_PUBLIC_PIPER_ENABLED=true       (client lê isso)
 *        PIPER_HTTP_URL=https://piper.dom     (server-side, /api/astro/tts proxy)
 *   3. Sem (1) + (2), o cliente cai automaticamente pro Web Speech do
 *      browser (sem erro, só qualidade inferior).
 */

const PIPER_ENABLED =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_PIPER_ENABLED === "true";

// Estado do <audio> atual quando Piper está tocando — pra cancel() poder pausar.
let currentPiperAudio: HTMLAudioElement | null = null;

// ─── iOS unlock ─────────────────────────────────────────────────────────
//
// iOS Safari bloqueia `audio.play()` E `speechSynthesis.speak()` quando
// chamados fora de um handler de evento síncrono iniciado pelo usuário.
// Nosso fluxo é assíncrono (mic → STT → LLM → TTS), então quando o speak
// roda já perdeu o "token de gesto" do clique original.
//
// `unlockAudio()` deve ser chamado DENTRO do onClick do mic (ou de
// qualquer outro botão que dispare áudio depois). Ele:
//   1. Toca um WAV silencioso de 100ms pra "destravar" HTMLAudioElement
//      pra próximas chamadas programáticas na mesma sessão.
//   2. Fala uma utterance vazia + cancela pra destravar speechSynthesis.
//
// No desktop é no-op (sem custo). No iOS, sem isso o Astro fica mudo
// porque o browser silenciosamente engole o play.
//
// Referências:
//   https://developer.apple.com/documentation/webkit/delivering_video_content_for_safari
//   https://developer.mozilla.org/en-US/docs/Web/Media/Autoplay_guide
let audioUnlocked = false;

// WAV silencioso de 100ms — mínimo necessário pra um play() registrar
// como "media playback iniciado pelo user" no iOS.
const SILENT_WAV_DATA_URI =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  if (audioUnlocked) return;
  try {
    const a = new Audio(SILENT_WAV_DATA_URI);
    a.volume = 0;
    const p = a.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        a.pause();
        a.src = "";
      }).catch(() => {
        /* iOS pode rejeitar mesmo com gesto se algo bloqueou; ignora */
      });
    }
  } catch {
    /* ignore */
  }
  try {
    const synth = window.speechSynthesis;
    if (synth) {
      const u = new SpeechSynthesisUtterance("");
      u.volume = 0;
      synth.speak(u);
      synth.cancel();
    }
  } catch {
    /* ignore */
  }
  audioUnlocked = true;
}
// Cache de health-check do Piper — evita pingar /api/astro/tts/health a cada
// fala. TTL curto (30s) pra reagir se o container subir/cair durante a sessão.
let piperHealthCache: { isUp: boolean; checkedAt: number } | null = null;
const PIPER_HEALTH_TTL_MS = 30_000;

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

// ─── Fila FIFO global ───────────────────────────────────────────────────
//
// Streaming TTS chama speak() múltiplas vezes em sequência (uma por chunk
// de frase). Sem fila, requests Piper paralelas geravam 2 áudios tocando
// simultâneo (1 cancelando o outro no meio). A fila garante uma utterance
// por vez, na ordem que chegou.

interface QueueItem {
  text: string;
  opts: SpeakOptions;
}

const speakQueue: QueueItem[] = [];
let isProcessingQueue = false;

/**
 * Fala o texto. Best-effort — silencia se browser não suportar ou usuário
 * não tiver interagido ainda (autoplay policy).
 *
 * Enfileira a chamada e processa em ordem. Cada utterance termina
 * (engine.onEnd) antes da próxima começar. Chamadas concorrentes não
 * geram áudios sobrepostos.
 */
export function speak(text: string, opts: SpeakOptions = {}): void {
  if (typeof window === "undefined") return;
  if (!text.trim()) return;

  speakQueue.push({ text, opts });
  void processQueue();
}

async function processQueue(): Promise<void> {
  if (isProcessingQueue) return;
  if (speakQueue.length === 0) return;
  isProcessingQueue = true;

  while (speakQueue.length > 0) {
    const item = speakQueue.shift()!;
    await speakOne(item.text, item.opts);
  }

  isProcessingQueue = false;
}

/**
 * Toca UM item da fila e resolve quando termina (ou falha). Tenta Piper
 * primeiro se habilitado; cai pro Web Speech como fallback.
 */
function speakOne(text: string, opts: SpeakOptions): Promise<void> {
  return new Promise<void>((resolve) => {
    let resolved = false;
    const done = () => {
      if (resolved) return;
      resolved = true;
      resolve();
    };

    const wrappedOpts: SpeakOptions = {
      ...opts,
      onEnd: () => {
        opts.onEnd?.();
        done();
      },
      onError: () => {
        opts.onError?.();
        done();
      },
    };

    if (PIPER_ENABLED) {
      void trySpeakViaPiper(text, wrappedOpts).then((handled) => {
        if (!handled) speakViaWebSpeech(text, wrappedOpts);
      });
    } else {
      speakViaWebSpeech(text, wrappedOpts);
    }
  });
}

// ─── Piper engine ───────────────────────────────────────────────────────

async function isPiperUp(): Promise<boolean> {
  const now = Date.now();
  if (piperHealthCache && now - piperHealthCache.checkedAt < PIPER_HEALTH_TTL_MS) {
    return piperHealthCache.isUp;
  }
  try {
    const r = await fetch("/api/astro/tts", {
      method: "GET",
      signal: AbortSignal.timeout(2_000),
    });
    const isUp = r.ok;
    piperHealthCache = { isUp, checkedAt: now };
    return isUp;
  } catch {
    piperHealthCache = { isUp: false, checkedAt: now };
    return false;
  }
}

/**
 * Tenta TTS via Piper. Retorna true se conseguiu tocar (ou disparou
 * onError/onEnd). False = não conseguiu, caller deve fallback.
 */
async function trySpeakViaPiper(
  text: string,
  opts: SpeakOptions,
): Promise<boolean> {
  if (!(await isPiperUp())) return false;

  // Preprocessing: aplica humanização leve (vocativos, conjunções) pro Piper
  // — ele já tem prosódia VITS boa, mas pausas extras ainda ajudam.
  const processed = humanizeForSpeech(stripMarkdownForSpeech(text));
  if (!processed.trim()) return false;

  try {
    const res = await fetch("/api/astro/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: processed,
        // Piper: length_scale > 1 = mais lento. 1.05 = leve pausa conversacional.
        length_scale: 1.05,
        noise_scale: 0.667,
        noise_w: 0.8,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      // 503 = Piper offline → marca cache + caller fallback
      if (res.status === 503) {
        piperHealthCache = { isUp: false, checkedAt: Date.now() };
      }
      return false;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    // Cancela qualquer áudio Piper anterior
    if (currentPiperAudio) {
      currentPiperAudio.pause();
      currentPiperAudio.src = "";
    }

    const audio = new Audio(url);
    audio.volume = opts.volume ?? 1.0;
    // Piper TTS tem rate controlado via length_scale acima; rate do <audio>
    // (playbackRate) também funciona mas distorce pitch. Mantemos 1.0.
    audio.playbackRate = 1.0;
    currentPiperAudio = audio;

    audio.addEventListener("play", () => opts.onStart?.(), { once: true });
    audio.addEventListener("ended", () => {
      URL.revokeObjectURL(url);
      if (currentPiperAudio === audio) currentPiperAudio = null;
      opts.onEnd?.();
    });
    audio.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      if (currentPiperAudio === audio) currentPiperAudio = null;
      opts.onError?.();
    });

    await audio.play();
    return true;
  } catch (err) {
    console.warn("[tts] Piper falhou, fallback Web Speech:", err);
    return false;
  }
}

// ─── Web Speech engine (renomeado pra ficar claro qual é qual) ──────────

function speakViaWebSpeech(text: string, opts: SpeakOptions): void {
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

/** Interrompe a fala atual + esvazia a fila (Web Speech + Piper). */
export function cancel(): void {
  if (typeof window === "undefined") return;
  // Esvazia fila pendente — utterances ainda não tocadas não tocam mais
  speakQueue.length = 0;
  window.speechSynthesis?.cancel();
  if (currentPiperAudio) {
    try {
      currentPiperAudio.pause();
      currentPiperAudio.src = "";
    } catch {
      /* ignore */
    }
    currentPiperAudio = null;
  }
}

/**
 * Retorna true se algum engine TTS pode rodar:
 *   - Piper habilitado e online (verificação assíncrona, mas se PIPER_ENABLED
 *     pelo menos pode tentar)
 *   - Web Speech Synthesis nativo do browser
 */
export function isTtsSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (PIPER_ENABLED) return true; // mesmo se Piper estiver down, vai fallback Web
  return (
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
