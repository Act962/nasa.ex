"use client";

import { Input } from "@/components/ui/input";
import { useState } from "react";

export interface EditingInputComponentProps {
  value: string;
  onSubmit: (value: string) => void;
  onCancel?: () => void;
}

export const InputEditField = ({
  value,
  onSubmit,
  onCancel,
}: EditingInputComponentProps) => {
  const [localValue, setLocalValue] = useState(value);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (localValue !== value) {
      onSubmit(localValue);
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
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => handleSubmit()}
        onKeyDown={handleKeyDown}
      />
      <button type="submit" className="hidden sr-only" />
    </form>
  );
};
