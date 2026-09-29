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
  /** Fora da página do contato (ex.: lateral do chat) o id vem por prop. */
  leadId?: string;
}

export function FieldText({
  label,
  value,
  fieldKey,
  placeholder = "Não informado",
  trackingId,
  leadId: leadIdProp,
}: FieldTextProps) {
  const params = useParams<{ leadId: string }>();
  const leadId = leadIdProp ?? params.leadId;
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

    const payload = { id: leadId, [fieldKey]: newValue } as Parameters<typeof mutation.mutate>[0];

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
