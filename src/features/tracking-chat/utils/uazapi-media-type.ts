import type { MediaType } from "@/http/uazapi/types";

type MediaDiscriminator = {
  mediaType?: string | null;
  mimetype?: string | null;
  fileName?: string | null;
};

export function inferUazapiMediaType(
  args: MediaDiscriminator,
): MediaType | null {
  const { mediaType, mimetype } = args;

  if (mediaType === "image" || mimetype?.startsWith("image/")) return "image";
  if (mediaType === "video" || mimetype?.startsWith("video/")) return "video";
  if (mediaType === "audio" || mimetype?.startsWith("audio/")) return "myaudio";
  if (mediaType === "sticker") return "sticker";
  if (mediaType === "document" || mimetype) return "document";
  return null;
}

const MEDIA_LABELS: Record<string, string> = {
  image: "📷 Imagem",
  video: "🎬 Vídeo",
  myaudio: "🎵 Áudio",
  audio: "🎵 Áudio",
  ptt: "🎵 Áudio",
  document: "📄 Documento",
  sticker: "💟 Figurinha",
};

export function mediaPreviewLabel(args: MediaDiscriminator): string {
  if (args.fileName) return args.fileName;
  const type = inferUazapiMediaType(args);
  return (type && MEDIA_LABELS[type]) ?? "📎 Mídia";
}
