/**
 * chat-lead-destination-fields — bloco das Configurações da Página que
 * define PRA ONDE vai o lead criado pelo ChatButton (In-Chat) desta page.
 *
 * Dois selects cascateados:
 *   1. Tracking (funil) — `useQueryTrackings`.
 *   2. Status (coluna do funil escolhido) — `useStatus(trackingId)`.
 *
 * Os valores vão pro `layout.meta` (`inChatTrackingId` / `inChatStatusId`)
 * via `updateMeta`, persistidos pelo autosave do builder — sem migration.
 * A rota `/api/in-chat/[slug]/identify` respeita esses valores ao criar o
 * lead (em vez de jogar no primeiro status do funil).
 *
 * Trocar de tracking reseta o status (um status pertence a um único
 * tracking — não faz sentido carregar status órfão).
 */
"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryTrackings } from "@/features/trackings/hooks/use-trackings";
import { useStatus } from "@/features/status/hooks/use-status";

export function ChatLeadDestinationFields({
  trackingId,
  statusId,
  updateMeta,
}: {
  trackingId?: string;
  statusId?: string;
  updateMeta: (patch: Record<string, unknown>) => void;
}) {
  const { trackings, isLoading: isLoadingTrackings } = useQueryTrackings();

  const handleTrackingChange = (value: string) => {
    // Reseta o status ao trocar de tracking pra não deixar status órfão.
    updateMeta({
      inChatTrackingId: value || undefined,
      inChatStatusId: undefined,
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-[11px] text-muted-foreground">
          Tracking (funil)
        </Label>
        <Select
          value={trackingId ?? ""}
          onValueChange={handleTrackingChange}
          disabled={isLoadingTrackings}
        >
          <SelectTrigger className="mt-1 h-8 w-full text-xs">
            <SelectValue placeholder="Selecione o funil" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {trackings?.map((tracking) => (
                <SelectItem key={tracking.id} value={tracking.id}>
                  {tracking.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-[11px] text-muted-foreground">Status</Label>
        <StatusSelect
          trackingId={trackingId ?? ""}
          value={statusId ?? ""}
          onChange={(value) =>
            updateMeta({ inChatStatusId: value || undefined })
          }
        />
      </div>
    </div>
  );
}

function StatusSelect({
  trackingId,
  value,
  onChange,
}: {
  trackingId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { status: statuses, isLoadingStatus } = useStatus(trackingId);

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={!trackingId || isLoadingStatus}
    >
      <SelectTrigger className="mt-1 h-8 w-full text-xs">
        <SelectValue
          placeholder={
            trackingId ? "Selecione o status" : "Escolha um funil antes"
          }
        />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {statuses?.map((status) => (
            <SelectItem key={status.id} value={status.id}>
              {status.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
