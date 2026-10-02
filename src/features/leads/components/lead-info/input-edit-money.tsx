"use client";

import { Input } from "@/components/ui/input";
import { useState } from "react";
import { maskMoney, unmaskMoney } from "@/utils/mask-money";
import { cn } from "@/lib/utils";

export interface EditingInputComponentProps {
  value: string;
  onSubmit: (value: number) => void;
  onCancel?: () => void;
  className?: string;
}

export const InputEditMoney = ({
  value,
  onSubmit,
  onCancel,
  className,
}: EditingInputComponentProps) => {
  const [localValue, setLocalValue] = useState(maskMoney(value));

  const handleSubmit = (e?: React.FormEvent) => {
    const number = unmaskMoney(localValue);
    e?.preventDefault();
    if (number) {
      onSubmit(number);
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
        className={cn("h-8 text-xs w-full", className)}
        autoFocus
        value={localValue}
        onChange={(e) => setLocalValue(maskMoney(e.target.value))}
        onBlur={() => handleSubmit()}
        onKeyDown={handleKeyDown}
      />
      <button type="submit" className="hidden sr-only" />
    </form>
  );
};
