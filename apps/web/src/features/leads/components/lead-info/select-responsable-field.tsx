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
import { useListTrackingParticipants } from "@/features/users/use-list-tracking-participants";
import { useState } from "react";

interface EditingDropdownComponentProps extends Omit<
  EditingInputComponentProps,
  "type"
> {
  label?: string;
  trackingId: string;
}

export const SelectResponsableField = ({
  value,
  onSubmit,
  trackingId,
}: EditingDropdownComponentProps) => {
  const { data } = useListTrackingParticipants(trackingId);
  const [isOpen, setIsOpen] = useState(false);

  const userSelectable = data ? data.participants.flatMap((p) => p.user) : [];

  const handleChange = (newValue: string) => {
    const selectedUser = userSelectable.find((user) => user.id === newValue);
    if (selectedUser) {
      onSubmit(selectedUser.id);
    }
  };
  const selectedUser =
    userSelectable.find((user) => user.id === value)?.name ?? "Selecione";

  const hasOnlySelectedOption =
    userSelectable.length === 1 && userSelectable[0].id === value;

  return (
    <Select
      value={value}
      onValueChange={handleChange}
      open={isOpen}
      onOpenChange={(open) => {
        if (hasOnlySelectedOption) return;
        setIsOpen(open);
      }}
    >
      <SelectTrigger className="w-45" size="sm" autoFocus>
        <SelectValue>{selectedUser}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {userSelectable.map((participant) => (
            <SelectItem
              key={`user-selectable-${participant.id}`}
              value={participant.id}
            >
              {participant.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};
