"use client";

import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { InfoItem } from "../Info-item";
import { InputEditField } from "../input-edit-field";

interface FieldEmailProps {
  /** Fora da página do contato (ex.: lateral do chat) o id vem por prop. */
  leadId?: string;
  label: string;
  value: string;
  trackingId: string;
}

export function FieldEmail({ label, value, trackingId, leadId: leadIdProp }: FieldEmailProps) {
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

    mutation.mutate(
      {
        id: leadId,
        email: newValue,
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
      value={localValue || "Não informado"}
      displayValue={localValue || "Não informado"}
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
