"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { normalizePhone, phoneMaskFull } from "@/utils/format-phone";
import { Pencil } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { InputEditField } from "./input-edit-field";
import { InputEditPhone } from "./input-edit-phone";
import { InputEditTag } from "./input-edit-tag";
import { SelectEditField } from "./select-edit-field";

export type FieldEditType =
  | "text"
  | "phone"
  | "email"
  | "responsible"
  | "tags"
  | null;

interface InfoItemProps {
  label: string;
  value: any; // Can be string or string[]
  displayValueOverride?: string;
  loading?: boolean;
  type: FieldEditType;
  fieldKey?: string;
  trackingId?: string;
  renderValue?: (val: any) => React.ReactNode;
}

export function InfoItem({
  label,
  value,
  displayValueOverride,
  loading,
  type,
  fieldKey,
  trackingId,
  renderValue,
}: InfoItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const { leadId } = useParams<{ leadId: string }>();

  const mutation = useMutationLeadUpdate(leadId);

  const handleToggle = () => setIsEditing((prev) => !prev);

  const handleEditField = (newValue: any) => {
    handleToggle();
    const previousValue = localValue;
    setLocalValue(newValue);

    if (!fieldKey) return;

    const payload: any = { id: leadId };

    // Transform value based on type if needed
    let finalValue = newValue;
    if (type === "phone") finalValue = normalizePhone(newValue);

    payload[fieldKey] = finalValue;

    mutation.mutate(payload, {
      onError: () => {
        setLocalValue(previousValue);
      },
    });
  };

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  if (loading) {
    return (
      <div className="flex flex-col w-full gap-1">
        <Skeleton className="w-full h-4 rounded-sm" />
        <Skeleton className="w-20 h-4 rounded-sm" />
      </div>
    );
  }

  const getDisplayValue = () => {
    if (displayValueOverride && !isEditing) return displayValueOverride;
    if (type === "phone") return phoneMaskFull(localValue);
    if (type === "tags" && Array.isArray(localValue))
      return localValue.join(", ");
    return localValue;
  };

  const renderedValue = renderValue
    ? renderValue(localValue)
    : getDisplayValue();

  return (
    <div className="flex flex-col gap-1 group">
      <span className="text-xs font-medium opacity-50">{label}</span>

      {!isEditing ? (
        <div className="flex items-center min-h-8">
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <span className="text-sm font-medium truncate max-w-[180px]">
                {renderedValue}
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{getDisplayValue()}</p>
            </TooltipContent>
          </Tooltip>

          {type && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleToggle}
            >
              <Pencil className="size-3" />
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center min-h-8 w-full">
          {type === "responsible" ? (
            <SelectEditField
              trackingId={trackingId!}
              value={localValue}
              onSubmit={handleEditField}
            />
          ) : type === "phone" ? (
            <InputEditPhone
              value={localValue}
              onSubmit={handleEditField}
              onCancel={handleToggle}
            />
          ) : type === "tags" ? (
            <InputEditTag
              trackingId={trackingId!}
              selectedTagIds={localValue}
              onSubmit={handleEditField}
              onCancel={handleToggle}
            />
          ) : (
            <InputEditField
              type={type === "email" ? "email" : "text"}
              value={localValue}
              onSubmit={handleEditField}
              onCancel={handleToggle}
            />
          )}
        </div>
      )}
    </div>
  );
}
