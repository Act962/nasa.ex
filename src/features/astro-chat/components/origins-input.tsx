"use client";

import { useState } from "react";
import { Globe, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Lista de domínios onde o widget pode aparecer (spec 0031, TR-1). */
export function OriginsInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (origins: string[]) => void;
}) {
  const [draftOrigin, setDraftOrigin] = useState("");

  const addOrigin = () => {
    const trimmed = draftOrigin.trim().replace(/\/+$/, "");
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setDraftOrigin("");
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draftOrigin}
          placeholder="https://www.suaempresa.com.br"
          onChange={(event) => setDraftOrigin(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addOrigin();
            }
          }}
        />
        <Button type="button" variant="outline" size="icon" onClick={addOrigin} aria-label="Adicionar domínio">
          <Plus className="size-4" />
        </Button>
      </div>
      {value.length === 0 ? (
        <p className="text-xs text-amber-600">Sem domínio cadastrado, o widget não aparece em lugar nenhum.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {value.map((origin) => (
            <li
              key={origin}
              className="flex items-center gap-1.5 rounded-full border bg-muted/50 py-1 pl-2.5 pr-1 text-xs"
            >
              <Globe className="size-3 text-muted-foreground" />
              {origin}
              <button
                type="button"
                className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => onChange(value.filter((item) => item !== origin))}
                aria-label={`Remover ${origin}`}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
