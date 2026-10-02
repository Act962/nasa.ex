"use client";

import { MicIcon, MicOffIcon, PhoneOffIcon } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { cn } from "@/lib/utils";
import type { VoiceCallStatus } from "./use-realtime-voice";

/** Barra da chamada de voz no lugar da caixa de texto: estado, tempo, mudo e encerrar (spec 0054, RF-5). */

const STATUS_LABELS: Record<VoiceCallStatus, string> = {
  idle: "",
  connecting: "Conectando…",
  listening: "Ouvindo você",
  speaking: "ASTRO falando",
  consulting: "Consultando seus dados…",
  ending: "Encerrando…",
};

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function VoiceWave({ status }: { status: VoiceCallStatus }) {
  const isAnimated = status === "listening" || status === "speaking";
  return (
    <span className="flex h-6 items-center gap-1" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((barIndex) => (
        <span
          key={barIndex}
          className={cn(
            "w-1 rounded-full",
            status === "speaking" ? "bg-info" : "bg-foreground/70",
            isAnimated ? "animate-pulse motion-reduce:animate-none" : "opacity-40",
          )}
          style={{ height: `${[40, 75, 100, 70, 45][barIndex]}%`, animationDelay: `${barIndex * 120}ms` }}
        />
      ))}
    </span>
  );
}

export function VoiceCallPanel({
  status,
  elapsedSeconds,
  isMuted,
  onToggleMute,
  onEnd,
}: {
  status: VoiceCallStatus;
  elapsedSeconds: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onEnd: () => void;
}) {
  const isBusy = status === "connecting" || status === "consulting";
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-4" role="status" aria-live="polite">
      <div className="flex min-w-0 items-center gap-3">
        {isBusy ? <OrbitaSpinner className="size-5 text-info" /> : <VoiceWave status={status} />}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{isMuted && status === "listening" ? "Microfone mudo" : STATUS_LABELS[status]}</p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {status === "connecting" ? "Conversa por voz com o ASTRO" : formatElapsed(elapsedSeconds)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onToggleMute}
          disabled={status === "connecting"}
          aria-label={isMuted ? "Ligar microfone" : "Silenciar microfone"}
          className={cn(
            "grid size-11 place-items-center rounded-full transition-colors disabled:opacity-40",
            isMuted ? "bg-foreground text-background" : "bg-knob text-foreground hover:bg-accent",
          )}
        >
          {isMuted ? <MicOffIcon className="size-5" /> : <MicIcon className="size-5" />}
        </button>
        <button
          type="button"
          onClick={onEnd}
          aria-label="Encerrar conversa por voz"
          className="grid size-11 place-items-center rounded-full bg-destructive/15 text-destructive transition-colors hover:bg-destructive/25"
        >
          <PhoneOffIcon className="size-5" />
        </button>
      </div>
    </div>
  );
}
