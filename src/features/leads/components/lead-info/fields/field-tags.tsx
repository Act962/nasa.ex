"use client";

import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { useEffect, useState } from "react";
import { InfoItem } from "../Info-item";
import { InputEditTag } from "../input-edit-tag";

interface FieldTagsProps {
  label: string;
  value: string[];
  displayNames: string;
  trackingId: string;
  renderValue?: (value: string[]) => React.ReactNode;
  leadId: string;
}

export function FieldTags({
  label,
  value,
  displayNames,
  trackingId,
  renderValue,
  leadId,
}: FieldTagsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  const mutation = useMutationLeadUpdate(leadId);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSubmit = (newValue: string[]) => {
    setIsEditing(false);
    const previousValue = localValue;
    setLocalValue(newValue);

    mutation.mutate(
      {
        id: leadId,
        tagIds: newValue,
      },
      {
        onError: () => {
          setLocalValue(previousValue);
        },
      },
    );
  };

  return (
    <InfoItem
      label={label}
      value={
        renderValue ? renderValue(localValue) : displayNames || "Nenhuma tag"
      }
      displayValue={displayNames}
      isEditing={isEditing}
      onEditClick={() => setIsEditing(true)}
      editable={true}
      editComponent={
        <InputEditTag
          trackingId={trackingId}
          selectedTagIds={localValue}
          onSubmit={handleSubmit}
          onCancel={() => setIsEditing(false)}
        />
      }
    />
  );
}
