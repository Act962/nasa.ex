import prisma from "@/lib/prisma";
import { getPresignedReadUrl } from "@/lib/r2-url";
import { meter } from "@/features/stars/lib/metering";
import { transcribeAudioBuffer } from "@/features/astro-bot/lib/audio-transcription";
import { MAX_LEAD_AUDIO_SECONDS, parseAiCapabilities } from "./capabilities";
import { isAudioTooLong, readAudioTranscription, toMessageMetadata } from "./audio-metadata";

// Áudio do cliente vira texto para o agente (spec 0084, RF-1 e RF-2). A
// transcrição fica em `Message.metadata`, sem coluna nova, e é o que o
// atendimento mostra embaixo do áudio.

const MAX_AUDIOS_PER_RUN = 3;
const RECENT_AUDIO_WINDOW_MS = 15 * 60_000;
const SECONDS_PER_MINUTE = 60;
const TRANSCRIPTION_MODEL = "whisper-1";

async function downloadStoredAudio(storageKey: string): Promise<Buffer | null> {
  const response = await fetch(await getPresignedReadUrl(storageKey, 300));
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

async function chargeTranscription(organizationId: string, seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / SECONDS_PER_MINUTE));
  await meter({
    organizationId,
    action: "astro_bot_transcription",
    quantity: { unit: "minute", amount: minutes },
    appSlug: "nasachat",
    description: `Chatbot IA — transcrição de ${minutes} min de áudio do cliente`,
    feature: "tracking-chat-ai.audio",
    cost: { kind: "TRANSCRIPTION", provider: "openai", modelId: TRANSCRIPTION_MODEL },
  }).catch((chargeError: unknown) => console.warn("[tracking-chat-ai/audio] cobrança da transcrição falhou", chargeError));
}

/**
 * Transcreve os áudios recentes do cliente que ainda não têm texto. Só roda com
 * a opção ligada; qualquer falha deixa o áudio como está e o agente segue.
 */
export async function transcribePendingLeadAudio(params: {
  trackingId: string;
  conversationId: string;
  organizationId: string;
}): Promise<{ transcribed: number }> {
  const settings = await prisma.aiSettings.findUnique({
    where: { trackingId: params.trackingId },
    select: { capabilities: true },
  });
  if (!parseAiCapabilities(settings?.capabilities).understandAudio) return { transcribed: 0 };

  const audioMessages = await prisma.message.findMany({
    where: {
      conversationId: params.conversationId,
      fromMe: false,
      mediaType: "audio",
      mediaUrl: { not: null },
      createdAt: { gte: new Date(Date.now() - RECENT_AUDIO_WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_AUDIOS_PER_RUN,
    select: { id: true, mediaUrl: true, mimetype: true, metadata: true },
  });

  let transcribed = 0;
  for (const message of audioMessages) {
    if (readAudioTranscription(message.metadata) || isAudioTooLong(message.metadata)) continue;
    try {
      const audio = await downloadStoredAudio(message.mediaUrl!);
      if (!audio) continue;
      const transcription = await transcribeAudioBuffer(audio, "audio-do-cliente.ogg", message.mimetype ?? undefined);
      if (!transcription) continue;
      const isTooLong = transcription.seconds > MAX_LEAD_AUDIO_SECONDS;
      await prisma.message.update({
        where: { id: message.id },
        data: {
          metadata: {
            ...toMessageMetadata(message.metadata),
            ...(isTooLong ? { transcriptionSkipped: "too_long" } : { transcription: transcription.text }),
          },
        },
      });
      await chargeTranscription(params.organizationId, transcription.seconds);
      if (!isTooLong && transcription.text) transcribed++;
    } catch (transcriptionError) {
      console.warn(
        "[tracking-chat-ai/audio] transcrição falhou:",
        transcriptionError instanceof Error ? transcriptionError.message.slice(0, 160) : "erro",
      );
    }
  }
  return { transcribed };
}
