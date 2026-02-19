"use client";

import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { InfoItem } from "../Info-item";
import { SelectEditField } from "../select-edit-field";

interface FieldResponsibleProps {
  label: string;
  value: string; // user ID
  displayName: string;
  trackingId: string;
  loading?: boolean;
}

export function FieldResponsible({
  label,
  value,
  displayName,
  trackingId,
  loading,
}: FieldResponsibleProps) {
  const { leadId } = useParams<{ leadId: string }>();
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [localDisplayName, setLocalDisplayName] = useState(displayName);

  const mutation = useMutationLeadUpdate(leadId);

  useEffect(() => {
    setLocalValue(value);
    setLocalDisplayName(displayName);
  }, [value, displayName]);

  const handleSubmit = (newValue: string) => {
    setIsEditing(false);
    const previousValue = localValue;
    setLocalValue(newValue);

    mutation.mutate(
      {
        id: leadId,
        responsibleId: newValue,
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
      value={localDisplayName || "Não atribuído"}
      isEditing={isEditing}
      onEditClick={() => setIsEditing(true)}
      loading={loading}
      editable
      editComponent={
        <SelectEditField
          trackingId={trackingId}
          value={localValue}
          onSubmit={handleSubmit}
          onCancel={() => setIsEditing(false)}
        />
      }
    />
  );
}
