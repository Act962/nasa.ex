"use client";

import { useState, useCallback, useRef } from "react";

export function useVariableAutocomplete(
  value: string,
  onChange: (value: string) => void
) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const triggerPosition = useRef<number | null>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "/") {
        const target = e.currentTarget as HTMLTextAreaElement | HTMLInputElement;
        const start = target.selectionStart || 0;
        
        // Trigger only if / is at start or preceded by space
        const charBefore = start > 0 ? value[start - 1] : " ";
        if (charBefore === " " || charBefore === "\n") {
          setOpen(true);
          setSearch("");
          triggerPosition.current = start;
        }
      } else if (open) {
        if (e.key === "Escape") {
          setOpen(false);
        } else if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Enter") {
          // Allow Command menu to handle navigation
        }
      }
    },
    [open, value]
  );

  const handleSelect = useCallback(
    (variable: string) => {
      if (triggerPosition.current !== null) {
        const before = value.substring(0, triggerPosition.current);
        const after = value.substring(triggerPosition.current + 1 + search.length);
        const newValue = `${before}${variable}${after}`;
        
        onChange(newValue);
        setOpen(false);
        setSearch("");
        triggerPosition.current = null;

        // Focus back and set cursor
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            const newPos = (before + variable).length;
            inputRef.current.setSelectionRange(newPos, newPos);
          }
        }, 0);
      }
    },
    [value, onChange, search]
  );

  const handleValueChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      const newValue = e.target.value;
      onChange(newValue);

      if (open && triggerPosition.current !== null) {
        const currentPos = e.target.selectionStart || 0;
        if (currentPos <= triggerPosition.current) {
          setOpen(false);
          return;
        }
        const currentSearch = newValue.substring(triggerPosition.current + 1, currentPos);
        if (currentSearch.includes(" ") || currentSearch.includes("\n")) {
          setOpen(false);
        } else {
          setSearch(currentSearch);
        }
      }
    },
    [open, onChange]
  );

  return {
    open,
    setOpen,
    search,
    setSearch,
    inputRef,
    handleKeyDown,
    handleSelect,
    handleValueChange,
  };
}
