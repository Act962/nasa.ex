import "server-only";
import OpenAI, { toFile } from "openai";
import type { UserWhatsappBinding } from "@/generated/prisma/client";
import { meter } from "@/features/stars/lib/metering/meter";
import type { BotInboundMedia } from "./types";
import { downloadFromTrackingProvider } from "./inbound-media";

// Áudio do membro vinculado vira texto (spec 0036): o resto do bot trata como
// se tivesse sido digitado.

const TRANSCRIPTION_MODEL = "whisper-1";
const MAX_AUDIO_SECONDS = 10 * 60;
const SECONDS_PER_MINUTE = 60;

export const AUDIO_UNAVAILABLE_REPLY =
  "🎧 Não consegui ouvir esse áudio. Pode me mandar por escrito?";
const AUDIO_TOO_LONG_REPLY =
  "🎧 Esse áudio passou de 10 minutos. Me manda um resumo por escrito, por favor.";

export type AudioDownloader = (trackingId: string, media: BotInboundMedia) => Promise<Buffer | null>;

export type AudioTranscription =
  | { isTranscribed: true; text: string; seconds: number; starsCharged: number }
  | { isTranscribed: false; reply: string };

function fileNameFor(media: BotInboundMedia): string {
  const extension = media.mimetype?.includes("mpeg") ? "mp3" : media.mimetype?.includes("mp4") ? "m4a" : "ogg";
  return media.fileName ?? `audio.${extension}`;
}

/** Transcreve o áudio de um buffer — separado do download para poder ser testado. */
export async function transcribeAudioBuffer(buffer: Buffer, fileName: string, mimetype?: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const openai = new OpenAI({ apiKey });
  const result = await openai.audio.transcriptions.create({
    file: await toFile(buffer, fileName, { type: mimetype ?? "audio/ogg" }),
    model: TRANSCRIPTION_MODEL,
    response_format: "verbose_json",
    language: "pt",
  });
  return { text: result.text.trim(), seconds: Math.ceil(result.duration ?? 0) };
}

async function chargeTranscription(binding: UserWhatsappBinding, seconds: number): Promise<number> {
  try {
    const minutes = Math.max(1, Math.ceil(seconds / SECONDS_PER_MINUTE));
    const charge = await meter({
      organizationId: binding.organizationId,
      action: "astro_bot_transcription",
      userId: binding.userId,
      quantity: { unit: "minute", amount: minutes },
      appSlug: "astro",
      description: `Astro pelo WhatsApp — transcrição de ${minutes} min de áudio`,
      feature: "astro.whatsapp.audio",
      cost: { kind: "TRANSCRIPTION", provider: "openai", modelId: TRANSCRIPTION_MODEL },
    });
    return charge.charged && charge.success ? charge.cost : 0;
  } catch (chargeError) {
    console.warn("[astro-bot/audio] cobrança da transcrição falhou", chargeError);
    return 0;
  }
}

export async function transcribeBotAudio(params: {
  binding: UserWhatsappBinding;
  trackingId: string;
  media: BotInboundMedia;
  isBillingExempt: boolean;
  downloadAudio?: AudioDownloader;
}): Promise<AudioTranscription> {
  try {
    const download = params.downloadAudio ?? downloadFromTrackingProvider;
    const buffer = await download(params.trackingId, params.media);
    if (!buffer) return { isTranscribed: false, reply: AUDIO_UNAVAILABLE_REPLY };
    const transcription = await transcribeAudioBuffer(buffer, fileNameFor(params.media), params.media.mimetype);
    if (!transcription || !transcription.text) return { isTranscribed: false, reply: AUDIO_UNAVAILABLE_REPLY };
    if (transcription.seconds > MAX_AUDIO_SECONDS) return { isTranscribed: false, reply: AUDIO_TOO_LONG_REPLY };
    const starsCharged = params.isBillingExempt ? 0 : await chargeTranscription(params.binding, transcription.seconds);
    return { isTranscribed: true, text: transcription.text, seconds: transcription.seconds, starsCharged };
  } catch (error) {
    console.error("[astro-bot/audio] transcrição falhou", error);
    return { isTranscribed: false, reply: AUDIO_UNAVAILABLE_REPLY };
  }
}
