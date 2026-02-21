"use client";

import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { normalizePhone, phoneMaskFull } from "@/utils/format-phone";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { InfoItem } from "../Info-item";
import { InputEditPhone } from "../input-edit-phone";

interface FieldPhoneProps {
  label: string;
  value: string;
}

export function FieldPhone({ label, value }: FieldPhoneProps) {
  const { leadId } = useParams<{ leadId: string }>();
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  const mutation = useMutationLeadUpdate(leadId);

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
        phone: normalizePhone(newValue),
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
      value={phoneMaskFull(localValue)}
      displayValue={phoneMaskFull(localValue)}
      isEditing={isEditing}
      onEditClick={() => setIsEditing(true)}
      editable
      editComponent={
        <InputEditPhone
          value={localValue}
          onSubmit={handleSubmit}
          onCancel={() => setIsEditing(false)}
        />
      }
    />
  );
}
