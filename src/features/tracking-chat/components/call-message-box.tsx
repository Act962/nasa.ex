"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PhoneIncomingIcon, PhoneOutgoingIcon, VideoIcon } from "lucide-react";
import { toast } from "sonner";

/** Fala guardada em `Message.metadata.callTranscript` pelas chamadas atendidas pelo Astro (spec 0087). */
interface CallTranscriptLine {
  speaker: "pessoa" | "astro" | "sistema";
  text: string;
  at: number;
}

const SPEAKER_LABEL: Record<CallTranscriptLine["speaker"], string> = { pessoa: "Cliente", astro: "Astro", sistema: "•" };

function readCallTranscript(metadata: unknown): { lines: CallTranscriptLine[]; isInterrupted: boolean } {
  if (!metadata || typeof metadata !== "object") return { lines: [], isInterrupted: false };
  const record = metadata as { callTranscript?: unknown; callInterrupted?: unknown };
  const lines = Array.isArray(record.callTranscript)
    ? record.callTranscript.filter(
        (line): line is CallTranscriptLine =>
          Boolean(line) && typeof line === "object" && typeof (line as CallTranscriptLine).text === "string",
      )
    : [];
  return { lines, isInterrupted: record.callInterrupted === true };
}

function formatLineTime(at: number): string {
  return new Date(at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function CallTranscriptDialog({ lines, isInterrupted }: { lines: CallTranscriptLine[]; isInterrupted: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const plainText = lines.map((line) => `[${formatLineTime(line.at)}] ${SPEAKER_LABEL[line.speaker]}: ${line.text}`).join("\n");
  return (
    <>
      <Button type="button" variant="link" size="sm" className="h-auto justify-start p-0 text-xs" onClick={() => setIsOpen(true)}>
        Ver transcrição
      </Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transcrição da ligação</DialogTitle>
          </DialogHeader>
          <div className="divide-y text-sm">
            {lines.map((line, lineIndex) => (
              <div key={lineIndex} className="flex gap-3 py-2">
                <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">{formatLineTime(line.at)}</span>
                <span className={cn("w-14 shrink-0 text-xs", line.speaker === "astro" ? "text-info" : "text-muted-foreground")}>
                  {SPEAKER_LABEL[line.speaker]}
                </span>
                <span className={cn("min-w-0", line.speaker === "sistema" && "italic text-muted-foreground")}>{line.text}</span>
              </div>
            ))}
            {isInterrupted && <p className="py-2 text-xs text-muted-foreground">A ligação foi interrompida.</p>}
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">O áudio não é gravado. Fica só o texto.</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(plainText);
                toast.success("Transcrição copiada");
              }}
            >
              Copiar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Card de mensagem de chamada (áudio/vídeo) — visual idêntico ao WhatsApp:
 * ícone circular grande + título em negrito + subtítulo (duração ou
 * "Toque para retornar"). Tom vermelho em ligações perdidas.
 *
 * Os dados de chamada são serializados em JSON no campo `body` da
 * Message com `mediaType: "voice_call" | "video_call"`. Schema:
 *
 *   {
 *     "type": "voice" | "video",
 *     "status": "completed" | "missed" | "declined" | "started",
 *     "durationSec": number | null,
 *   }
 *
 * Se o `body` não for JSON válido, faz fallback pra texto humano simples
 * ("Ligação de voz" / "Ligação de vídeo").
 */
export interface CallPayload {
  type: "voice" | "video";
  status: "completed" | "missed" | "declined" | "started";
  durationSec?: number | null;
}

/** Parser tolerante — aceita string JSON OU já parseado. */
export function parseCallPayload(
  body: string | null | undefined,
  mediaType: string | null | undefined,
): CallPayload | null {
  if (mediaType !== "voice_call" && mediaType !== "video_call") return null;
  const fallbackType: "voice" | "video" =
    mediaType === "video_call" ? "video" : "voice";

  if (!body) {
    return { type: fallbackType, status: "completed", durationSec: null };
  }
  try {
    const parsed = JSON.parse(body);
    return {
      type: parsed.type ?? fallbackType,
      status: parsed.status ?? "completed",
      durationSec: parsed.durationSec ?? null,
    };
  } catch {
    // Body veio como texto humano, não JSON — usa só o mediaType
    return { type: fallbackType, status: "completed", durationSec: null };
  }
}

function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec < 0) return "";
  if (sec < 60) return `${sec} ${sec === 1 ? "segundo" : "segundos"}`;
  const minutes = Math.floor(sec / 60);
  const remaining = sec % 60;
  if (remaining === 0) {
    return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  }
  return `${minutes}min ${remaining}s`;
}

export function CallMessageBox({
  payload,
  fromMe,
  metadata,
}: {
  payload: CallPayload;
  /** Dados extras da mensagem: a transcrição da ligação, quando o Astro atendeu. */
  metadata?: unknown;
  /** `fromMe` é orientação visual: outgoing vs incoming arrow do ícone. */
  fromMe: boolean;
}) {
  const transcript = readCallTranscript(metadata);
  const isMissed = payload.status === "missed" || payload.status === "declined";
  const isVideo = payload.type === "video";

  const title = isVideo
    ? isMissed
      ? "Ligação de vídeo perdida"
      : "Ligação de vídeo"
    : isMissed
      ? "Ligação de voz perdida"
      : "Ligação de voz";

  const subtitle = isMissed
    ? "Toque para retornar"
    : payload.durationSec
      ? formatDuration(payload.durationSec)
      : payload.status === "started"
        ? "Em andamento"
        : "";

  // Ícone — pra ligações perdidas usa cor vermelha; pra completadas, neutro.
  // Direção da seta indica outgoing/incoming (segue convenção do WhatsApp).
  const Icon = isVideo
    ? VideoIcon
    : fromMe
      ? PhoneOutgoingIcon
      : PhoneIncomingIcon;

  return (
    <div className="flex items-center gap-3 min-w-[200px]">
      <div
        className={cn(
          "shrink-0 size-10 rounded-full flex items-center justify-center",
          isMissed
            ? "bg-destructive/10 dark:bg-destructive/15"
            : "bg-muted dark:bg-card",
        )}
      >
        <Icon
          className={cn(
            "size-5",
            isMissed
              ? "text-destructive"
              : "text-foreground dark:text-foreground",
          )}
        />
      </div>
      <div className="flex flex-col min-w-0">
        <span
          className={cn(
            "text-sm font-semibold leading-tight",
            isMissed && "text-destructive",
          )}
        >
          {title}
        </span>
        {subtitle && (
          <span className="text-xs text-muted-foreground dark:text-muted-foreground leading-tight mt-0.5">
            {subtitle}
          </span>
        )}
        {transcript.lines.length > 0 && <CallTranscriptDialog lines={transcript.lines} isInterrupted={transcript.isInterrupted} />}
      </div>
    </div>
  );
}
