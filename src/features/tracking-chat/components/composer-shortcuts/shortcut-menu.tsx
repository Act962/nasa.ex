"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { ShortcutItem } from "./use-composer-shortcuts";

interface ShortcutMenuProps {
  items: ShortcutItem[];
  activeIndex: number;
  onHover: (index: number) => void;
  onPick: (item: ShortcutItem) => void;
  isLoading?: boolean;
}

/** Lista dos atalhos "@" e "/" logo acima do campo de mensagem. */
export function ShortcutMenu({ items, activeIndex, onHover, onPick, isLoading = false }: ShortcutMenuProps) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <ul
      ref={listRef}
      role="listbox"
      className="absolute inset-x-2 bottom-full z-30 mb-2 max-h-[min(19rem,45vh)] overflow-y-auto rounded-2xl border bg-popover p-1 shadow-xl"
    >
      {isLoading ? <li className="px-3 py-2 text-sm text-muted-foreground">Carregando…</li> : null}
      {items.map((item, index) => (
        <li key={item.id} role="option" aria-selected={index === activeIndex} data-index={index}>
          <button
            type="button"
            // Sem isso o campo perde o foco antes do clique e a lista fecha.
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => onHover(index)}
            onClick={() => onPick(item)}
            className={cn(
              "flex w-full min-w-0 flex-col items-start rounded-xl px-3 py-2 text-left",
              index === activeIndex ? "bg-muted" : "hover:bg-muted/60",
            )}
          >
            <span className="w-full truncate text-sm font-medium">{item.label}</span>
            {item.hint ? <span className="w-full truncate text-xs text-muted-foreground">{item.hint}</span> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
