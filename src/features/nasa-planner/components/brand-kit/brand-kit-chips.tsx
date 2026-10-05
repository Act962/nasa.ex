"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/** Lista editável de textos curtos (frases, palavras proibidas, hashtags, CTAs). */
export function BrandKitChips({
  values,
  placeholder,
  canEdit,
  isNegative = false,
  prefix = "",
  onChange,
}: {
  values: string[];
  placeholder: string;
  canEdit: boolean;
  isNegative?: boolean;
  prefix?: string;
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const addDraft = () => {
    const value = draft.trim().replace(/^#/, "");
    if (!value || values.includes(value)) return;
    onChange([...values, value]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <div className={cn("flex flex-wrap gap-1.5", values.length === 0 && canEdit && "hidden")}>
        {values.map((value) => (
          <span key={value} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs", isNegative ? "bg-destructive/10 text-destructive" : "bg-card")}>
            {prefix}
            {value}
            {canEdit && (
              <button type="button" onClick={() => onChange(values.filter((current) => current !== value))} aria-label={`Remover ${value}`}>
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        {values.length === 0 && !canEdit && <span className="text-xs text-muted-foreground">Nenhum item.</span>}
      </div>
      {canEdit && (
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addDraft();
            }
          }}
          onBlur={addDraft}
          placeholder={placeholder}
          className="h-9 rounded-xl text-sm"
        />
      )}
    </div>
  );
}
