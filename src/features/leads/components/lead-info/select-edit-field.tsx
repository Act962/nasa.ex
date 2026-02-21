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

interface EditingDropdownComponentProps extends Omit<
  EditingInputComponentProps,
  "type"
> {
  label?: string;
  trackingId: string;
}

export const SelectEditField = ({
  value,
  onSubmit,
  trackingId,
}: EditingDropdownComponentProps) => {
  const { data } = useListTrackingParticipants(trackingId);

  const userSelectable = data ? data.participants.flatMap((p) => p.user) : [];

  const handleChange = (newValue: string) => {
    const selectedUser = userSelectable.find((user) => user.id === newValue);
    if (selectedUser) {
      onSubmit(selectedUser.id);
    }
  };

  const labelSelect =
    userSelectable.find((user) => user.id === value)?.name ?? "Selecione";

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="w-45" size="sm" autoFocus>
        <SelectValue>{labelSelect}</SelectValue>
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
