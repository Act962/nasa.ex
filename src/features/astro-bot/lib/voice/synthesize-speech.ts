import "server-only";
import { envKeyFor, loadOrganizationKeys } from "@/features/ia/lib/router/providers";
import { findBotVoice } from "./voices";

/**
 * Camada de voz do Astro no WhatsApp (spec 0083, RF-11). Hoje só a OpenAI;
 * outro provedor entra como mais um caso aqui, sem tocar em quem chama.
 */

const SPEECH_TIMEOUT_MS = 20_000;
// "Ritmo de conversa" fazia o modelo falar pausado, palavra por palavra (teste real de 10/10/2026).
const SPEECH_INSTRUCTIONS =
  "Leia em português do Brasil de forma direta e contínua, em ritmo acelerado e constante, como um locutor de rádio dando um recado rápido. Não faça pausas entre as palavras nem no meio das frases. Tom neutro e firme, sem dramatizar.";

export interface SynthesizedSpeech {
  audio: Buffer;
  mimetype: "audio/ogg" | "audio/mpeg";
  provider: "openai";
  modelId: string;
  usingCustomKey: boolean;
}

/** Devolve `null` em qualquer falha: quem chama responde em texto (RF-8). */
export async function synthesizeSpeech(params: {
  text: string;
  voiceName: string | null | undefined;
  organizationId: string;
  /** "opus" (padrão) é o que o WhatsApp aceita como nota de voz; "mp3" toca em qualquer navegador. */
  format?: "opus" | "mp3";
}): Promise<SynthesizedSpeech | null> {
  const format = params.format ?? "opus";
  const voice = findBotVoice(params.voiceName);
  const organizationKey = (await loadOrganizationKeys(params.organizationId)).openai?.apiKey;
  const apiKey = organizationKey ?? envKeyFor("openai");
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: voice.modelId,
        voice: voice.name,
        input: params.text,
        response_format: format,
        speed: voice.speed,
        // O modelo clássico não aceita instrução de estilo.
        ...(voice.modelId === "gpt-4o-mini-tts" ? { instructions: SPEECH_INSTRUCTIONS } : {}),
      }),
      signal: AbortSignal.timeout(SPEECH_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn("[astro-bot/voice] geração de áudio recusada:", response.status);
      return null;
    }
    return {
      audio: Buffer.from(await response.arrayBuffer()),
      mimetype: format === "opus" ? "audio/ogg" : "audio/mpeg",
      provider: "openai",
      modelId: voice.modelId,
      usingCustomKey: Boolean(organizationKey),
    };
  } catch (speechError) {
    console.warn("[astro-bot/voice] geração de áudio falhou:", speechError instanceof Error ? speechError.name : "erro");
    return null;
  }
}
