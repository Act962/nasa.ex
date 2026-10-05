"use client";

import Link from "next/link";
import { format } from "date-fns";
import { MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { usePlannerCalendarBroadcasts } from "../../hooks/use-planner-integrations";

/** Disparo de WhatsApp no calendário (spec 0060, RF-4): abre a campanha nas Campanhas. */

export type CalendarBroadcast = ReturnType<typeof usePlannerCalendarBroadcasts>["broadcasts"][number];

const BROADCAST_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendado",
  SENDING: "Enviando",
  SENT: "Enviado",
  PAUSED: "Pausado",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
};

export function broadcastDate(broadcast: CalendarBroadcast) {
  const rawDate = broadcast.scheduledAt ?? broadcast.startedAt;
  return rawDate ? new Date(rawDate) : null;
}

export function BroadcastChip({ broadcast, isCompact = false }: { broadcast: CalendarBroadcast; isCompact?: boolean }) {
  const date = broadcastDate(broadcast);
  return (
    <Link
      href={`/campanhas/${broadcast.id}`}
      title={`Disparo WhatsApp · ${broadcast.tracking.name}`}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-[14px] bg-brand-whatsapp/10 p-1 pr-2 text-left text-[11.5px] transition hover:bg-brand-whatsapp/20",
        broadcast.status === "FAILED" && "ring-1 ring-destructive",
      )}
    >
      <span className={cn("grid shrink-0 place-items-center rounded-[10px] bg-brand-whatsapp text-white", isCompact ? "size-5" : "size-7")}>
        <MessageSquareText className="size-3" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{broadcast.name}</span>
        {!isCompact && (
          <span className="block truncate text-[10.5px] text-muted-foreground">
            Disparo{date && ` · ${format(date, "HH:mm")}`} · {BROADCAST_STATUS_LABELS[broadcast.status] ?? broadcast.status} · {broadcast.totalRecipients} contatos
          </span>
        )}
      </span>
    </Link>
  );
}
