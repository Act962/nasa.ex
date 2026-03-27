"use client";

import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { useParams } from "next/navigation";
import { useState } from "react";
import { SelectTrackingPopover } from "../select-tracking-field";
import { PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { InfoItem } from "../Info-item";

interface FieldTrackingProps {
  trackingId: string;
  trackingName: string;
  statusId: string;
}

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
        }
      }
    );
  };

  return (
    <div className="flex flex-col gap-2 group w-full">
      <div className="flex justify-between items-center w-full">
        <div className="flex-1 min-w-0 pr-2">
          <InfoItem label="Fluxo / Tracking" value={trackingName} />
        </div>
        
        <SelectTrackingPopover
          currentTrackingId={trackingId}
          currentStatusId={statusId}
          onSubmit={handleSubmit}
          isLoading={mutation.isPending}
          open={isEditing}
          onOpenChange={setIsEditing}
        >
          <Button
            variant={"ghost"}
            size={"icon-sm"}
            className="opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity mt-3"
            disabled={mutation.isPending}
            onClick={() => setIsEditing(true)}
          >
            {mutation.isPending ? (
              <Spinner />
            ) : (
              <PencilIcon className="size-3" />
            )}
          </Button>
        </SelectTrackingPopover>
      </div>
    </div>
  );
}
