"use client";

import { parseVideoUrl } from "../../lib/video-url";

interface VideoEmbedProps {
  url: string | null | undefined;
  title?: string;
  className?: string;
}

export function VideoEmbed({ url, title = "Vídeo", className }: VideoEmbedProps) {
  const parsed = parseVideoUrl(url);

  if (!parsed.embedUrl) {
    return (
      <div
        className={
          "flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground " +
          (className ?? "")
        }
      >
        Vídeo indisponível
      </div>
    );
  }

  return (
    <div className={"aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black " + (className ?? "")}>
      <iframe
        src={parsed.embedUrl}
        title={title}
        className="h-full w-full"
        loading="lazy"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
