"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditingInputComponentProps } from "./input-edit-field";
import { useStatus } from "@/features/status/hooks/use-status";
import { useEffect, useState } from "react";

interface EditingDropdownComponentProps extends Omit<
  EditingInputComponentProps,
  "type"
> {
  label?: string;
  trackingId: string;
  isLoading?: boolean;
}

export function SelectStatusField({
  value,
  onSubmit,
  trackingId,
  isLoading,
}: EditingDropdownComponentProps) {
  const { status: statueses } = useStatus(trackingId);
  const [isOpen, setIsOpen] = useState(true);

  const handleChange = (newValue: string) => {
    const selectedStatus = statueses.find((status) => status.id === newValue);
    if (selectedStatus) {
      onSubmit(selectedStatus.id);
      setIsOpen(false);
    }
  };

  const labelSelect =
    statueses.find((status) => status.id === value)?.name ?? "Selecione";

  const hasOnlySelectedOption =
    statueses.length === 1 && statueses[0].id === value;

  return (
    <Select
      value={value}
      onValueChange={handleChange}
      open={isOpen}
      onOpenChange={(open) => {
        if (hasOnlySelectedOption) {
          return;
        }
        setIsOpen(open);
      }}
    >
      <SelectTrigger
        disabled={hasOnlySelectedOption}
        className="w-45"
        size="sm"
      >
        <SelectValue>{labelSelect}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {statueses.map((status) => (
            <SelectItem
              key={`Status-selectable-${status.id}`}
              value={status.id}
              disabled={isLoading}
            >
              {status.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
