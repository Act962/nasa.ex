"use client";

import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { useParams } from "next/navigation";
import { useState } from "react";
import { SelectTrackingPopover } from "../select-tracking-field";
import { ChevronsUpDownIcon, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface FieldTrackingProps {
  trackingId: string;
  trackingName: string;
  statusId: string;
}

/**
 * Campo "Fluxo / Tracking" no detalhe do lead. Render no estilo do
 * `FieldProject`: um trigger sempre visível mostrando o tracking atual +
 * chevron. Clicar abre o popover (SelectTrackingPopover) com seleção de
 * tracking + status (ambos obrigatórios pra mover o lead pra outro fluxo).
 */
export function FieldTracking({
  trackingId,
  trackingName,
  statusId,
}: FieldTrackingProps) {
  const { leadId } = useParams<{ leadId: string }>();
  const [isEditing, setIsEditing] = useState(false);

  const mutation = useMutationLeadUpdate(leadId, trackingId);

  const handleSubmit = (newTrackingId: string, newStatusId: string) => {
    mutation.mutate(
      {
        id: leadId,
        trackingId: newTrackingId,
        statusId: newStatusId,
      },
      {
        onSuccess: () => {
          setIsEditing(false);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-1 w-full">
      <span className="text-xs font-medium opacity-50">Fluxo / Tracking</span>
      <SelectTrackingPopover
        currentTrackingId={trackingId}
        currentStatusId={statusId}
        onSubmit={handleSubmit}
        isLoading={mutation.isPending}
        open={isEditing}
        onOpenChange={setIsEditing}
      >
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isEditing}
          className="w-full justify-between font-normal h-8 text-sm"
          disabled={mutation.isPending}
          onClick={() => setIsEditing(true)}
        >
          <div className="flex items-center gap-2 truncate">
            <GitBranch className="size-4 shrink-0 opacity-60" />
            <span className="truncate">
              {trackingName || (
                <span className="text-muted-foreground">
                  Selecionar fluxo
                </span>
              )}
            </span>
          </div>
          {mutation.isPending ? (
            <Spinner className="ml-2 size-4 shrink-0" />
          ) : (
            <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
          )}
        </Button>
      </SelectTrackingPopover>
    </div>
  );
}
