"use client";

import { useEffect, useState } from "react";
import { ChevronsUpDownIcon, PencilIcon } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { cn } from "@/lib/utils";
import { maskMoney } from "@/utils/mask-money";
import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { InputEditMoney } from "@/features/leads/components/lead-info/input-edit-money";
import { SelectTrackingPopover } from "@/features/leads/components/lead-info/select-tracking-field";

// Cartão do negócio na lateral do chat: valor e etapa do lead, editáveis no lugar.

interface LeadSidebarDealProps {
  leadId: string;
  trackingId: string;
  trackingName: string;
  statusId: string;
  statusName: string;
  statusColor: string | null;
  amount: number;
}

const ROW_CLASSES =
  "group flex w-full items-center gap-2.5 px-3.5 py-3 text-left outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 disabled:pointer-events-none disabled:opacity-60";

const EYEBROW_CLASSES = "text-[11px] font-medium tracking-wide text-muted-foreground uppercase";

export function LeadSidebarDeal({
  leadId,
  trackingId,
  trackingName,
  statusId,
  statusName,
  statusColor,
  amount,
}: LeadSidebarDealProps) {
  const mutation = useMutationLeadUpdate(leadId, trackingId);
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [localAmount, setLocalAmount] = useState(amount);

  useEffect(() => setLocalAmount(amount), [amount]);

  const saveAmount = (nextAmount: number) => {
    setIsEditingAmount(false);
    if (nextAmount === localAmount) return;
    const previousAmount = localAmount;
    setLocalAmount(nextAmount);
    mutation.mutate(
      { id: leadId, amount: nextAmount },
      { onError: () => setLocalAmount(previousAmount) },
    );
  };

  const moveLead = (nextTrackingId: string, nextStatusId: string) => {
    mutation.mutate(
      { id: leadId, trackingId: nextTrackingId, statusId: nextStatusId },
      { onSuccess: () => setIsMoveOpen(false) },
    );
  };

  return (
    <div className="overflow-hidden rounded-[1.15rem] border border-line bg-card">
      {isEditingAmount ? (
        <div className="flex flex-col gap-1.5 bg-accent/60 px-3.5 py-3">
          <span className={EYEBROW_CLASSES}>Valor</span>
          <InputEditMoney
            className="h-9 text-base font-semibold tabular-nums md:text-base"
            value={localAmount.toString()}
            onSubmit={saveAmount}
            onCancel={() => setIsEditingAmount(false)}
          />
          <span className="text-[11px] text-muted-foreground">Enter salva · Esc cancela</span>
        </div>
      ) : (
        <button
          type="button"
          title="Editar valor"
          disabled={mutation.isPending}
          onClick={() => setIsEditingAmount(true)}
          className={ROW_CLASSES}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={EYEBROW_CLASSES}>Valor</span>
            <span className="truncate text-[22px] leading-tight font-semibold tracking-tight tabular-nums">
              {maskMoney(localAmount)}
            </span>
          </span>
          <PencilIcon className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
        </button>
      )}

      <SelectTrackingPopover
        currentTrackingId={trackingId}
        currentStatusId={statusId}
        onSubmit={moveLead}
        isLoading={mutation.isPending}
        open={isMoveOpen}
        onOpenChange={setIsMoveOpen}
      >
        <button
          type="button"
          title="Mover lead"
          disabled={mutation.isPending}
          className={cn(ROW_CLASSES, "border-t border-line", isMoveOpen && "bg-accent/60")}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={EYEBROW_CLASSES}>Etapa</span>
            <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: statusColor ?? "var(--muted-foreground)" }}
              />
              <span className="truncate">{statusName}</span>
            </span>
            <span className="truncate text-xs text-muted-foreground">{trackingName}</span>
          </span>
          {mutation.isPending ? (
            <OrbitaSpinner className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
          )}
        </button>
      </SelectTrackingPopover>
    </div>
  );
}
