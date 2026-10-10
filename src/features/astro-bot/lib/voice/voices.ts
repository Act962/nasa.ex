// Vozes oferecidas na resposta em áudio do Astro (spec 0083, RF-2). Sem "server-only": a tela lê esta lista.

export const VOICE_REPLY_MODES = ["off", "match", "always"] as const;
export type VoiceReplyMode = (typeof VOICE_REPLY_MODES)[number];

export interface BotVoiceOption {
  /** Nome da voz no provedor. */
  name: string;
  label: string;
  description: string;
  /** Cada voz existe em um modelo: Onyx e Nova no clássico; Cedar e Marin só no mais novo. */
  modelId: "tts-1-hd" | "gpt-4o-mini-tts";
  speed: number;
}

// A primeira é a padrão: escolhida pelo Weydson ouvindo amostras em 10/10/2026.
export const BOT_VOICES: BotVoiceOption[] = [
  { name: "onyx", label: "Onyx", description: "Masculina, firme", modelId: "tts-1-hd", speed: 1.1 },
  { name: "nova", label: "Nova", description: "Feminina, clara", modelId: "tts-1-hd", speed: 1.1 },
  { name: "cedar", label: "Cedar", description: "Masculina, natural", modelId: "gpt-4o-mini-tts", speed: 1.15 },
  { name: "marin", label: "Marin", description: "Feminina, natural", modelId: "gpt-4o-mini-tts", speed: 1.15 },
];

export const DEFAULT_BOT_VOICE = BOT_VOICES[0].name;

export function findBotVoice(voiceName: string | null | undefined): BotVoiceOption {
  return BOT_VOICES.find((voice) => voice.name === voiceName) ?? BOT_VOICES[0];
}

export function resolveBotVoice(voiceName: string | null | undefined): string {
  return findBotVoice(voiceName).name;
}

export function toVoiceReplyMode(value: string | null | undefined): VoiceReplyMode {
  return VOICE_REPLY_MODES.find((mode) => mode === value) ?? "off";
}

export const VOICE_SAMPLE_TEXT =
  "Oi! Eu sou o Astro. É assim que eu vou responder os seus áudios no WhatsApp.";
