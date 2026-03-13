"use client";

import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SelectStatusField } from "../select-status-field";
import { PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { getContrastColor } from "@/utils/get-contrast-color";

interface FieldsStatusProps {
  status: { id: string; name: string; color: string | null };
  displayName: string;
  trackingId: string;
}

export function FieldsStatus({
  status,
  displayName,
  trackingId,
}: FieldsStatusProps) {
  const { leadId } = useParams<{ leadId: string }>();
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(status.name);

  const mutation = useMutationLeadUpdate(leadId, trackingId);

  useEffect(() => {
    setLocalValue(status.name);
  }, [status]);

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
            value={status.id}
            isLoading={mutation.isPending}
          />
        ) : (
          <div className="flex justify-between items-center w-full">
            <span className={"text-sm font-medium truncate"}>
              <Badge
                style={{
                  backgroundColor: status.color!,
                  color: getContrastColor(status.color!),
                }}
              >
                {status.name}
              </Badge>
            </span>
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
