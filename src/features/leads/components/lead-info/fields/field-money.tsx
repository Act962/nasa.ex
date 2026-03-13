"use client";

import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import { normalizePhone, phoneMaskFull } from "@/utils/format-phone";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { InfoItem } from "../Info-item";
import { InputEditMoney } from "../input-edit-money";
import { maskMoney } from "@/utils/mask-money";

interface FieldMoneyProps {
  label: string;
  value: number;
  trackingId: string;
}

export function FieldMoney({ label, value, trackingId }: FieldMoneyProps) {
  const { leadId } = useParams<{ leadId: string }>();
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  const mutation = useMutationLeadUpdate(leadId, trackingId);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSubmit = (newValue: number) => {
    setIsEditing(false);
    const previousValue = localValue;
    setLocalValue(newValue);

    mutation.mutate(
      {
        id: leadId,
        amount: newValue,
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
      value={maskMoney(localValue)}
      displayValue={maskMoney(localValue)}
      isEditing={isEditing}
      onEditClick={() => setIsEditing(true)}
      editable={!mutation.isPending}
      editComponent={
        <InputEditMoney
          value={localValue.toString()}
          onSubmit={handleSubmit}
          onCancel={() => setIsEditing(false)}
        />
      }
    />
  );
}
