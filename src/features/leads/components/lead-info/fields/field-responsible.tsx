"use client";

import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { InfoItem } from "../Info-item";
import { SelectStatusField } from "../select-status-field";
import { SelectResponsableField } from "../select-responsable-field";

interface FieldResponsibleProps {
  /** Fora da página do contato (ex.: lateral do chat) o id vem por prop. */
  leadId?: string;
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
  leadId: leadIdProp,
}: FieldResponsibleProps) {
  const params = useParams<{ leadId: string }>();
  const leadId = leadIdProp ?? params.leadId;
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [localDisplayName, setLocalDisplayName] = useState(displayName);

  const mutation = useMutationLeadUpdate(leadId, trackingId);

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
        <SelectResponsableField
          trackingId={trackingId}
          value={localValue}
          onSubmit={handleSubmit}
          onCancel={() => setIsEditing(false)}
        />
      }
    />
  );
}
