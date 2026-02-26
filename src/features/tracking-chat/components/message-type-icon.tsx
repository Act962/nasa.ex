import {
  FileIcon,
  ImageIcon,
  MicIcon,
  MusicIcon,
  VideoIcon,
  StickerIcon,
} from "lucide-react";

interface MessageTypeIconProps {
  mimetype?: string | null;
  className?: string;
}

export function MessageTypeIcon({
  mimetype,
  className = "size-3",
}: MessageTypeIconProps) {
  if (!mimetype) return null;

  if (mimetype.startsWith("image/")) {
    if (mimetype === "image/webp") {
      return <StickerIcon className={className} />;
    }
    return <ImageIcon className={className} />;
  }

  if (mimetype.startsWith("audio/")) {
    return <MicIcon className={className} />;
  }

  if (mimetype.startsWith("video/")) {
    return <VideoIcon className={className} />;
  }

  return <FileIcon className={className} />;
}

export function getMessageTypeName(
  mimetype?: string | null,
  fileName?: string | null,
) {
  if (!mimetype) return null;

  if (mimetype.startsWith("image/")) {
    if (mimetype === "image/webp") {
      return "Figurinha";
    }
    return "Foto";
  }

  if (mimetype.startsWith("audio/")) {
    return "Áudio";
  }

  if (mimetype.startsWith("video/")) {
    return "Vídeo";
  }

  return fileName || "Documento";
}
