"use client";

/**
 * Vídeo na bolha do chat (spec 0004, RF-9 / CA-8).
 *
 * Antes desta spec nenhuma branch do `message-box` cobria `video/*` — vídeos
 * (inclusive os recebidos do lead) renderizavam como bolha vazia.
 *
 * Alvo visual é o WhatsApp: frame de capa com botão de play sobreposto e
 * duração no canto; os controles nativos só entram depois do play, porque a
 * barra de controle do browser ocupa a bolha inteira em repouso.
 *
 * `preload="metadata"` traz o primeiro frame e a duração sem baixar o
 * arquivo inteiro de quem só rolou a conversa.
 */

import { useRef, useState } from "react";
import { PlayIcon } from "lucide-react";
import { useConstructUrl } from "@/hooks/use-construct-url";

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

interface VideoMessageBoxProps {
  mediaUrl: string;
  fileName?: string | null;
}

export function VideoMessageBox({ mediaUrl, fileName }: VideoMessageBoxProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [duration, setDuration] = useState("");
  const [isHighDefinition, setIsHighDefinition] = useState(false);
  const resolvedUrl = useConstructUrl(mediaUrl);

  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (!video) return;
    setDuration(formatDuration(video.duration));
    // Mesmo critério do selo do WhatsApp: o menor lado a partir de 720p.
    setIsHighDefinition(Math.min(video.videoWidth, video.videoHeight) >= 720);
  }

  function startPlayback() {
    const video = videoRef.current;
    if (!video) return;
    setHasStarted(true);
    void video.play();
  }

  return (
    <div className="relative w-72 max-w-full overflow-hidden rounded-lg bg-black">
      <video
        ref={videoRef}
        src={resolvedUrl}
        preload="metadata"
        playsInline
        controls={hasStarted}
        onPlay={() => setHasStarted(true)}
        onLoadedMetadata={handleLoadedMetadata}
        className="block max-h-80 w-full object-contain"
      />

      {!hasStarted && (
        <>
          <button
            type="button"
            onClick={startPlayback}
            aria-label={`Reproduzir ${fileName ?? "vídeo"}`}
            className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/5 transition-colors hover:bg-black/20"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-black/55 backdrop-blur-[2px] transition-transform duration-150 hover:scale-105">
              {/* translate-x-px centra o triângulo opticamente no círculo. */}
              <PlayIcon className="size-6 translate-x-px fill-white text-white" />
            </span>
          </button>

          {duration && (
            <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1">
              {isHighDefinition && (
                <span className="rounded-sm bg-black/60 px-1 py-0.5 text-[9px] font-bold leading-none text-white">
                  HD
                </span>
              )}
              <span className="rounded-sm bg-black/60 px-1.5 py-0.5 text-[10px] leading-none text-white tabular-nums">
                {duration}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
