"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ComboboxItem {
  value: string;
  label: string;
  hint?: string;
  color?: string;
  /** Miniatura à esquerda; cai na inicial de `label` se a imagem falhar. */
  imageUrl?: string;
  /** Liga o slot de miniatura mesmo sem imagem (mostra só a inicial). */
  hasAvatar?: boolean;
}

interface SettingsComboboxProps {
  value: string;
  onChange: (value: string) => void;
  items: ComboboxItem[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  isLoading?: boolean;
  /** Presente = a busca é do servidor, então o cmdk não filtra localmente. */
  onSearchChange?: (search: string) => void;
  allowClear?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Um controle só para escolher entre opções: o campo de busca mora dentro do
 * popover, e não solto ao lado do seletor.
 */
export function SettingsCombobox({
  value,
  onChange,
  items,
  placeholder,
  searchPlaceholder = "Buscar…",
  emptyLabel = "Nada encontrado.",
  disabled,
  isLoading,
  onSearchChange,
  allowClear = true,
  compact,
  className,
}: SettingsComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = items.find((item) => item.value === value);
  const isServerSearch = Boolean(onSearchChange);
  const canClear = Boolean(allowClear && selected && !disabled);

  function handleSearch(nextSearch: string) {
    setSearch(nextSearch);
    onSearchChange?.(nextSearch);
  }

  function handleSelect(nextValue: string) {
    onChange(nextValue === value ? "" : nextValue);
    setIsOpen(false);
  }

  return (
    // O botão de limpar fica fora do trigger: dentro dele, o clique borbulharia
    // e abriria a lista que acabou de ser esvaziada.
    <div className={cn("relative", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            disabled={disabled}
            className={cn(
              "w-full justify-between gap-2 font-normal",
              compact ? "h-8 text-xs" : "h-9",
              canClear && "pr-11",
              !selected && "text-muted-foreground",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              {selected?.color && (
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: selected.color }}
                />
              )}
              {selected && (selected.hasAvatar || selected.imageUrl) && (
                <OptionAvatar item={selected} />
              )}
              <span className="truncate">{selected?.label ?? placeholder}</span>
            </span>

            <span className="flex shrink-0 items-center gap-1">
              {isLoading && (
                <Loader2 className="size-3.5 animate-spin opacity-50" />
              )}
              <ChevronsUpDown className="size-3.5 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-56 p-0"
        >
          <Command shouldFilter={!isServerSearch}>
            <CommandInput
              value={search}
              onValueChange={handleSearch}
              placeholder={searchPlaceholder}
            />
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Carregando…" : emptyLabel}
              </CommandEmpty>
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={
                    isServerSearch ? item.value : `${item.label} ${item.value}`
                  }
                  onSelect={() => handleSelect(item.value)}
                  className="gap-2"
                >
                  {item.color && (
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                  )}
                  {(item.hasAvatar || item.imageUrl) && (
                    <OptionAvatar item={item} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.label}</span>
                    {item.hint && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.hint}
                      </span>
                    )}
                  </span>
                  {item.value === value && (
                    <Check className="size-4 shrink-0 text-primary" />
                  )}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {canClear && (
        <button
          type="button"
          aria-label="Limpar seleção"
          onClick={() => onChange("")}
          className={cn(
            "absolute top-1/2 right-7 -translate-y-1/2 rounded-sm p-0.5",
            "text-muted-foreground transition hover:bg-muted hover:text-foreground",
          )}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Miniatura da opção. A imagem vem de uma rota protegida que devolve 404 para
 * quem não tem logo — por isso o erro cai na inicial em vez de quebrar a linha.
 */
function OptionAvatar({ item }: { item: ComboboxItem }) {
  const [hasFailed, setHasFailed] = useState(false);
  const showImage = Boolean(item.imageUrl) && !hasFailed;

  return (
    <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted text-[10px] font-medium text-muted-foreground">
      {showImage ? (
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setHasFailed(true)}
        />
      ) : (
        item.label.trim().charAt(0).toUpperCase() || "?"
      )}
    </span>
  );
}
