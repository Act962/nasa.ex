"use client";

import { useState } from "react";
import { Loader2Icon, MinusIcon, PlusIcon, SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAstroEntitySearch } from "@/features/astro/hooks/use-astro-entity-search";
import {
  buildPickedAnswer,
  buildPickedList,
  type AstroPicker,
} from "@/features/astro/lib/astro-picker";

type EntityPicker = Extract<AstroPicker, { kind: "entity" }>;

/**
 * Busca do registro no próprio cartão: o usuário escolhe um lead ou uma
 * agenda que existe, em vez de digitar um nome que o ASTRO teria de adivinhar.
 */
export function AstroEntityPicker({
  picker,
  initialOptions,
  onPick,
  disabled,
}: {
  picker: EntityPicker;
  /** Opções que o ASTRO já achou — aparecem antes de digitar. */
  initialOptions?: { id: string; label: string }[];
  onPick: (answer: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<
    Map<string, { label: string; quantity: number }>
  >(new Map());
  const isMultiple = picker.multiple === true;

  const changeQuantity = (
    row: { id: string; label: string },
    delta: number,
  ) => {
    setSelection((current) => {
      const next = new Map(current);
      const quantity = (next.get(row.id)?.quantity ?? 0) + delta;
      if (quantity <= 0) next.delete(row.id);
      else next.set(row.id, { label: row.label, quantity });
      return next;
    });
  };
  const selectedItems = [...selection.entries()].map(([id, item]) => ({
    id,
    ...item,
  }));
  const { matches, isSearching } = useAstroEntitySearch({
    entity: picker.entity,
    query,
  });

  const hasQuery = query.trim().length > 0;
  const rows =
    !hasQuery && initialOptions && initialOptions.length > 0
      ? initialOptions
          // Saídas como "Nenhum por enquanto" (id "__none__") viram o botão próprio.
          .filter((option) => !option.id.startsWith("__"))
          .map((option) => ({
            id: option.id,
            label: option.label,
            hint: undefined,
          }))
      : matches;

  return (
    <div className="space-y-2">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
        <input
          autoFocus
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={picker.placeholder ?? "Buscar"}
          className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950/60 pl-8 pr-8 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500/60 focus:outline-none"
        />
        {isSearching && (
          <Loader2Icon className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-zinc-500" />
        )}
      </div>

      <ul className="max-h-52 space-y-1 overflow-y-auto">
        {rows.map((row) => (
          <li key={row.id}>
            {isMultiple ? (
              <div className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 hover:bg-zinc-800/60">
                <span className="min-w-0">
                  <span className="block truncate text-sm text-zinc-100">
                    {row.label}
                  </span>
                  {row.hint && (
                    <span className="block truncate text-[11px] text-zinc-500">
                      {row.hint}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {selection.has(row.id) && (
                    <>
                      <button
                        type="button"
                        aria-label={`Menos ${row.label}`}
                        disabled={disabled}
                        onClick={() => changeQuantity(row, -1)}
                        className="grid size-6 place-items-center rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      >
                        <MinusIcon className="size-3" />
                      </button>
                      <span className="w-5 text-center text-xs tabular-nums text-zinc-100">
                        {selection.get(row.id)?.quantity}
                      </span>
                    </>
                  )}
                  <button
                    type="button"
                    aria-label={`Mais ${row.label}`}
                    disabled={disabled}
                    onClick={() => changeQuantity(row, 1)}
                    className="grid size-6 place-items-center rounded-md bg-violet-500/20 text-violet-200 hover:bg-violet-500/30"
                  >
                    <PlusIcon className="size-3" />
                  </button>
                </span>
              </div>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(buildPickedAnswer(row.label, row.id))}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                  "hover:bg-violet-500/15 disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <span className="truncate text-sm text-zinc-100">
                  {row.label}
                </span>
                {row.hint && (
                  <span className="shrink-0 truncate text-[11px] text-zinc-500">
                    {row.hint}
                  </span>
                )}
              </button>
            )}
          </li>
        ))}
        {rows.length === 0 && !isSearching && (
          <li className="px-2.5 py-2 text-xs text-zinc-500">
            {hasQuery
              ? "Nada encontrado com esse nome."
              : "Digite para buscar."}
          </li>
        )}
      </ul>

      {isMultiple && (
        <button
          type="button"
          disabled={disabled || selectedItems.length === 0}
          onClick={() => onPick(buildPickedList(selectedItems))}
          className="w-full rounded-lg bg-violet-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {selectedItems.length === 0
            ? "Escolha ao menos um"
            : `Usar ${selectedItems.reduce((total, item) => total + item.quantity, 0)} item(ns)`}
        </button>
      )}

      {picker.noneOption && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onPick(picker.noneOption!.answer)}
          className="w-full rounded-lg border border-dashed border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
        >
          {picker.noneOption.label}
        </button>
      )}
    </div>
  );
}
