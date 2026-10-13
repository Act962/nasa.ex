// Leitura da transcrição guardada em `Message.metadata` (spec 0084). Sem
// dependência de servidor: a tela do atendimento também usa.

type MessageMetadata = Record<string, unknown>;

export function toMessageMetadata(raw: unknown): MessageMetadata {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as MessageMetadata) : {};
}

export function readAudioTranscription(rawMetadata: unknown): string | null {
  const transcription = toMessageMetadata(rawMetadata).transcription;
  return typeof transcription === "string" && transcription.trim() ? transcription.trim() : null;
}

export function isAudioTooLong(rawMetadata: unknown): boolean {
  return toMessageMetadata(rawMetadata).transcriptionSkipped === "too_long";
}
