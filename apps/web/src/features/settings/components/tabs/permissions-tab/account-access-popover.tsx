"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type AccountAccessOption = {
  key: string;
  label: string;
  hint?: string | null;
};

export function AccountAccessPopover({
  triggerLabel,
  triggerHint,
  emptyLabel,
  options,
  selectedKeys,
  disabled,
  onSave,
}: {
  triggerLabel: string;
  triggerHint?: string;
  emptyLabel?: string;
  options: AccountAccessOption[];
  selectedKeys: string[];
  disabled?: boolean;
  onSave: (keys: string[]) => Promise<unknown> | void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<string[]>(selectedKeys);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.key.toLowerCase().includes(q) ||
        (o.hint ?? "").toLowerCase().includes(q),
    );
  }, [options, search]);

  const allSelected = filtered.length > 0 && filtered.every((o) => draft.includes(o.key));

  const toggle = (key: string) => {
    setDraft((d) => (d.includes(key) ? d.filter((k) => k !== key) : [...d, key]));
  };

  const toggleAllFiltered = () => {
    if (allSelected) {
      const filteredKeys = new Set(filtered.map((f) => f.key));
      setDraft((d) => d.filter((k) => !filteredKeys.has(k)));
    } else {
      setDraft((d) => Array.from(new Set([...d, ...filtered.map((f) => f.key)])));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setDraft(selectedKeys);
          setSearch("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || options.length === 0}
          className={cn("h-8 gap-1.5 text-xs", options.length === 0 && "opacity-60")}
        >
          {options.length === 0
            ? (emptyLabel ?? "Sem opções")
            : (
              <>
                <span className="font-medium">{triggerLabel}</span>
                {triggerHint && <span className="text-muted-foreground">{triggerHint}</span>}
              </>
            )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="end">
        <div className="border-b p-2 space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conta…"
              className="h-8 pl-7 text-xs"
            />
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={toggleAllFiltered}
              disabled={filtered.length === 0}
              className="text-[11px] text-[#7C3AED] font-medium hover:underline disabled:opacity-40"
            >
              {allSelected ? "Desmarcar todos" : "Marcar todos"}
            </button>
            <span className="text-[11px] text-muted-foreground">
              {draft.length}/{options.length} marcados
            </span>
          </div>
        </div>
        <div className="max-h-[260px] overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Nenhuma conta encontrada
            </p>
          ) : (
            filtered.map((opt) => {
              const checked = draft.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toggle(opt.key)}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
                >
                  <Checkbox checked={checked} className="pointer-events-none mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{opt.label}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {opt.key}
                      {opt.hint ? ` · ${opt.hint}` : ""}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t p-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
