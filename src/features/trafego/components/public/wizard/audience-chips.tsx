"use client";

import { useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  AUDIENCE_DIMENSIONS,
  dimensionSpec,
  isDimensionAvailable,
  type AudienceChip,
  type AudienceDimension,
  type AudienceDimensionSpec,
  type SpecialAdCategory,
} from "@/features/trafego/lib/audience";

interface AudienceChipsProps {
  chips: AudienceChip[];
  onChange: (chips: AudienceChip[]) => void;
  specialCategory: SpecialAdCategory;
}

/**
 * Público em chips em vez de texto livre: o que o cliente escolhe aqui vira
 * segmentação de verdade lá na plataforma. Gênero e idade somem quando o
 * anúncio é de categoria especial — Meta e Google proíbem, é antidiscriminação.
 */
export function AudienceChips({ chips, onChange, specialCategory }: AudienceChipsProps) {
  const available = AUDIENCE_DIMENSIONS.filter((spec) =>
    isDimensionAvailable(spec, chips, specialCategory),
  );

  const replaceAt = (index: number, value: string) =>
    onChange(chips.map((chip, position) => (position === index ? { ...chip, value } : chip)));

  const removeAt = (index: number) =>
    onChange(chips.filter((_, position) => position !== index));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip, index) => (
        <ChipEditor
          key={`${chip.dimension}-${index}`}
          spec={dimensionSpec(chip.dimension)}
          value={chip.value}
          onChange={(value) => replaceAt(index, value)}
          onRemove={() => removeAt(index)}
        />
      ))}

      {available.length > 0 && (
        <AddDimension
          specs={available}
          onAdd={(dimension, value) => onChange([...chips, { dimension, value }])}
        />
      )}
    </div>
  );
}

function ChipEditor({
  spec,
  value,
  onChange,
  onRemove,
}: {
  spec: AudienceDimensionSpec;
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className="inline-flex items-center rounded-full border border-violet-400/35 bg-violet-500/[0.12] pl-3 text-xs text-white">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="inline-flex items-center gap-1 py-1.5">
            {value || spec.label}
            <ChevronDown className="size-3 text-white/50" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-1.5">
          <ValuePicker
            spec={spec}
            current={value}
            onPick={(next) => {
              onChange(next);
              setIsOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover ${spec.label}`}
        className="px-2 py-1.5 text-white/40 transition hover:text-white"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function AddDimension({
  specs,
  onAdd,
}: {
  specs: AudienceDimensionSpec[];
  onAdd: (dimension: AudienceDimension, value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [picked, setPicked] = useState<AudienceDimensionSpec | null>(null);

  function close() {
    setIsOpen(false);
    setPicked(null);
  }

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setPicked(null);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/20 px-3 py-1.5 text-xs text-white/55 transition hover:border-white/35 hover:text-white"
        >
          <Plus className="size-3" />
          Adicionar
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1.5">
        {picked ? (
          <ValuePicker
            spec={picked}
            current=""
            onPick={(value) => {
              onAdd(picked.id, value);
              close();
            }}
          />
        ) : (
          <ul className="space-y-0.5">
            {specs.map((spec) => (
              <li key={spec.id}>
                <button
                  type="button"
                  onClick={() => setPicked(spec)}
                  className="w-full rounded-md px-2.5 py-1.5 text-left text-xs transition hover:bg-accent"
                >
                  {spec.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ValuePicker({
  spec,
  current,
  onPick,
}: {
  spec: AudienceDimensionSpec;
  current: string;
  onPick: (value: string) => void;
}) {
  const [draft, setDraft] = useState(current);

  if (spec.kind === "text") {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) onPick(draft.trim());
        }}
        className="p-1"
      >
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={spec.placeholder}
          className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-ring"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="mt-1.5 w-full rounded-md bg-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
        >
          Adicionar
        </button>
      </form>
    );
  }

  return (
    <ul className="max-h-64 space-y-0.5 overflow-y-auto">
      {(spec.options ?? []).map((option) => (
        <li key={option}>
          <button
            type="button"
            onClick={() => onPick(option)}
            className={cn(
              "w-full rounded-md px-2.5 py-1.5 text-left text-xs transition hover:bg-accent",
              option === current && "bg-accent font-medium",
            )}
          >
            {option}
          </button>
        </li>
      ))}
    </ul>
  );
}
