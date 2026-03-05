"use client";

import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SelectStatusField } from "../select-status-field";
import { PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface FieldsStatusProps {
  value: string;
  displayName: string;
  trackingId: string;
  statusId: string;
}

export function FieldsStatus({
  value,
  displayName,
  trackingId,
  statusId,
}: FieldsStatusProps) {
  const { leadId } = useParams<{ leadId: string }>();
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  const mutation = useMutationLeadUpdate(leadId, trackingId);

  useEffect(() => {
    setLocalValue(value);
  }, [value, displayName]);

  const handleSubmit = (newValue: string) => {
    setIsEditing(false);
    const previousValue = localValue;
    setLocalValue(newValue);

    mutation.mutate(
      {
        id: leadId,
        statusId: newValue,
      },
      {
        onError: () => {
          setLocalValue(previousValue);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-2 group">
      <span className="text-xs font-bold text-muted-foreground tracking-tight">
        Status:
      </span>
      <div className="flex flex-wrap gap-2">
        {isEditing ? (
          <SelectStatusField
            onSubmit={handleSubmit}
            trackingId={trackingId}
            onCancel={() => setIsEditing(false)}
            value={statusId}
            isLoading={mutation.isPending}
          />
        ) : (
          <div className="flex justify-between items-center w-full">
            {value}
            <Button
              variant={"ghost"}
              size={"icon-sm"}
              className="opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity "
              onClick={() => setIsEditing(true)}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <Spinner />
              ) : (
                <PencilIcon className="size-3" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
