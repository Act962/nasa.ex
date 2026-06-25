"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useMunicipioSearch } from "../hooks/use-municipio-search";
import type { FocusMunicipio } from "@/http/focus-nfe/types";

type Props = {
  displayValue: string;
  onSelect: (municipio: FocusMunicipio) => void;
  placeholder?: string;
};

export function MunicipioCombobox({
  displayValue,
  onSelect,
  placeholder = "Buscar município...",
}: Props) {
  const [query, setQuery] = useState(displayValue);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { municipios, isLoading } = useMunicipioSearch(open ? query : "");

  useEffect(() => {
    setQuery(displayValue);
  }, [displayValue]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showDropdown = open && query.length >= 2;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="pr-8"
        />
        {isLoading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-md max-h-56 overflow-y-auto">
          {municipios.length === 0 && !isLoading ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Nenhum município encontrado
            </p>
          ) : (
            municipios.map((municipio) => (
              <button
                key={municipio.codigo_ibge}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex justify-between gap-4"
                onMouseDown={() => {
                  setQuery(`${municipio.nome} — ${municipio.uf}`);
                  setOpen(false);
                  onSelect(municipio);
                }}
              >
                <span>{municipio.nome}</span>
                <span className="text-muted-foreground shrink-0">
                  {municipio.uf}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
