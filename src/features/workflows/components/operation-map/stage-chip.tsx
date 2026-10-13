"use client";

import { MapPinIcon } from "lucide-react";
import { useQueryTrackings } from "@/features/trackings/hooks/use-trackings";
import { useTrackingStatusNames } from "@/features/trackings/hooks/use-tracking-status-names";
import { cn } from "@/lib/utils";

// Etiqueta "Tracking > Status" (spec 0092): em que etapa do funil o lead está naquele trecho do fluxo.

interface StageChipProps {
  /** Funil do fluxo, usado quando o trecho não aponta para outro. */
  ownTrackingId: string;
  trackingId: string | null;
  statusId: string | null;
  className?: string;
}

export function StageChip({ ownTrackingId, trackingId, statusId, className }: StageChipProps) {
  const stageTrackingId = trackingId ?? ownTrackingId;
  const { trackings } = useQueryTrackings();
  const { data: statusData } = useTrackingStatusNames(statusId ? stageTrackingId : undefined);
  const statuses = (statusData as { status?: { id: string; name: string }[] } | undefined)?.status ?? [];
  const trackingName = trackings.find((tracking) => tracking.id === stageTrackingId)?.name ?? "Funil";
  const statusName = statusId ? (statuses.find((status) => status.id === statusId)?.name ?? "coluna") : "qualquer etapa";
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-[11px] font-medium leading-tight",
        className,
      )}
      title={`${trackingName} › ${statusName}`}
    >
      <MapPinIcon className="size-3 shrink-0 text-info" />
      <span className="truncate">
        {trackingName} <span className="text-muted-foreground">›</span> {statusName}
      </span>
    </span>
  );
}
