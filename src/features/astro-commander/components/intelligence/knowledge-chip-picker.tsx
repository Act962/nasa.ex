"use client";

import { cn } from "@/lib/utils";

interface KnowledgeOption {
  id: string;
  name: string;
}

/** Etiquetas de marcar quais documentos da Auto Inteligência um canal pode usar. */
export function KnowledgeChipPicker({
  options,
  selectedIds,
  onChange,
  emptyText = "Nenhuma base cadastrada no ASTRO.",
}: {
  options: KnowledgeOption[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  emptyText?: React.ReactNode;
}) {
  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selectedIds.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() =>
              onChange(isSelected ? selectedIds.filter((id) => id !== option.id) : [...selectedIds, option.id])
            }
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition",
              isSelected ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {option.name}
          </button>
        );
      })}
    </div>
  );
}
