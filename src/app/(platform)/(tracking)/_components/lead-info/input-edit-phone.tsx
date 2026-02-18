"use client";

import { Input } from "@/components/ui/input";
import { normalizePhone, phoneMaskFull } from "@/utils/format-phone";
import { useState } from "react";

export interface EditingInputComponentProps {
  value: string;
  onSubmit: (value: string) => void;
  onCancel?: () => void;
}

export const InputEditPhone = ({
  value,
  onSubmit,
  onCancel,
}: EditingInputComponentProps) => {
  const [localValue, setLocalValue] = useState(normalizePhone(value));

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const normalized = normalizePhone(localValue);
    if (normalized !== normalizePhone(value)) {
      onSubmit(normalized);
    } else {
      onCancel?.();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel?.();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <Input
        className="h-8 text-xs w-full"
        autoFocus
        value={phoneMaskFull(localValue)}
        onChange={(e) => setLocalValue(normalizePhone(e.target.value))}
        onBlur={() => handleSubmit()}
        onKeyDown={handleKeyDown}
      />
      <button type="submit" className="hidden sr-only" />
    </form>
  );
};
