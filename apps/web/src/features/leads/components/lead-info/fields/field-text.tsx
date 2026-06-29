"use client";

import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { InfoItem } from "../Info-item";
import { InputEditField } from "../input-edit-field";

interface FieldTextProps {
  label: string;
  value: string;
  fieldKey: string;
  placeholder?: string;
  trackingId: string;
}

export function FieldText({
  label,
  value,
  fieldKey,
  placeholder = "Não informado",
  trackingId,
}: FieldTextProps) {
  const { leadId } = useParams<{ leadId: string }>();
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  const mutation = useMutationLeadUpdate(leadId, trackingId);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSubmit = (newValue: string) => {
    setIsEditing(false);
    const previousValue = localValue;
    setLocalValue(newValue);

    const payload: any = { id: leadId };
    payload[fieldKey] = newValue;

    mutation.mutate(payload, {
      onError: () => {
        setLocalValue(previousValue);
      },
    });
  };

  return (
    <InfoItem
      label={label}
      value={localValue || placeholder}
      isEditing={isEditing}
      onEditClick={() => setIsEditing(true)}
      editable
      editComponent={
        <InputEditField
          value={localValue}
          onSubmit={handleSubmit}
          onCancel={() => setIsEditing(false)}
        />
      }
    />
  );
}
