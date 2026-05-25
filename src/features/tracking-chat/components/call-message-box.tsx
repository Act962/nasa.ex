"use client";

import { cn } from "@/lib/utils";
import { PhoneIncomingIcon, PhoneOutgoingIcon, VideoIcon } from "lucide-react";

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
}: {
  payload: CallPayload;
  /** `fromMe` é orientação visual: outgoing vs incoming arrow do ícone. */
  fromMe: boolean;
}) {
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
            ? "bg-red-50 dark:bg-red-950/40"
            : "bg-zinc-100 dark:bg-zinc-800",
        )}
      >
        <Icon
          className={cn(
            "size-5",
            isMissed
              ? "text-red-500"
              : "text-zinc-700 dark:text-zinc-200",
          )}
        />
      </div>
      <div className="flex flex-col min-w-0">
        <span
          className={cn(
            "text-sm font-semibold leading-tight",
            isMissed && "text-red-600 dark:text-red-400",
          )}
        >
          {title}
        </span>
        {subtitle && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400 leading-tight mt-0.5">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
