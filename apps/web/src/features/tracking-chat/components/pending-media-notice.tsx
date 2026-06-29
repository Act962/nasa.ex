"use client";

import {
  AlertTriangleIcon,
  FileIcon,
  ImageIcon,
  MicIcon,
  StickerIcon,
  VideoIcon,
} from "lucide-react";

const ICON_BY_TYPE: Record<string, typeof FileIcon> = {
  image: ImageIcon,
  audio: MicIcon,
  video: VideoIcon,
  document: FileIcon,
  sticker: StickerIcon,
};

const LABEL_BY_TYPE: Record<string, string> = {
  image: "Imagem",
  audio: "Áudio",
  video: "Vídeo",
  document: "Arquivo",
  sticker: "Sticker",
};

interface PendingMediaNoticeProps {
  mediaType: string;
}

export function PendingMediaNotice({ mediaType }: PendingMediaNoticeProps) {
  const Icon = ICON_BY_TYPE[mediaType] ?? FileIcon;
  const label = LABEL_BY_TYPE[mediaType] ?? "Mídia";
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground w-72">
      <Icon className="size-4 shrink-0" />
      <div className="flex flex-col min-w-0">
        <span className="font-medium text-foreground/80">
          {label} não disponível
        </span>
        <span className="flex items-center gap-1">
          <AlertTriangleIcon className="size-3 text-amber-500" />
          Mensagem sincronizada — mídia não foi importada.
        </span>
      </div>
    </div>
  );
}
