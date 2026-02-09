import { useState } from "react";
import { TypeFieldLead } from "./Info-item";
import { Input } from "@/components/ui/input";
import { phoneMaskFull } from "@/utils/format-phone";

export interface EditingInputComponentProps {
  value: string;
  onSubmit: (value: string) => void;
  type: TypeFieldLead;
}

export const InputEditField = ({
  value,
  onSubmit,
  type,
}: EditingInputComponentProps) => {
  const [localValue, setLocalValue] = useState(value);

  const handleSubmit = (e: React.FormEvent) => {
    onSubmit(localValue);
    e.preventDefault();
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input
        className="h-8 text-xs"
        autoFocus
        value={type === "phone" ? phoneMaskFull(localValue) : localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleSubmit}
      />
      <button type="submit" className="hidden sr-only" />
    </form>
  );
};
