"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { SearchIcon, CheckIcon, ChevronDownIcon } from "lucide-react";

// ─── Entity type → oRPC entity type mapping ───────────────────────────────────

export type EntityType =
  | "agenda"
  | "lead"
  | "product"
  | "tracking"
  | "trackingStatus"
  | "user"
  | "workspace"
  | "workspaceColumn";

// Map field keys from needs_input to entity types
const FIELD_ENTITY_MAP: Record<string, EntityType> = {
  // Agenda
  agenda: "agenda",
  agendaname: "agenda",
  agenda_name: "agenda",
  // Lead / client
  lead: "lead",
  leadname: "lead",
  lead_name: "lead",
  cliente: "lead",
  clientename: "lead",
  client_name: "lead",
  clientname: "lead",
  // NOTE: "contato" is intentionally NOT mapped — it's free text (phone/email)
  // Product
  produto: "product",
  productname: "product",
  product_name: "product",
  product: "product",
  // Tracking
  tracking: "tracking",
  trackingname: "tracking",
  tracking_name: "tracking",
  pipeline: "tracking",
  funil: "tracking",
  // Status
  status: "trackingStatus",
  statusname: "trackingStatus",
  status_name: "trackingStatus",
  // User / responsible
  usuario: "user",
  responsavel: "user",
  user: "user",
  // Workspace
  workspace: "workspace",
  // Column
  coluna: "workspaceColumn",
  column: "workspaceColumn",
};

export function getEntityType(fieldKey: string): EntityType | null {
  return FIELD_ENTITY_MAP[fieldKey.toLowerCase().replace(/[^a-z0-9]/g, "")] ?? null;
}

// ─── Result item ──────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface EntitySearchFieldProps {
  fieldKey: string;
  label: string;
  entityType: EntityType;
  parentId?: string;
  value: string;
  onChange: (value: string, label: string) => void;
  placeholder?: string;
}

export function EntitySearchField({
  fieldKey,
  label,
  entityType,
  parentId,
  value,
  onChange,
  placeholder,
}: EntitySearchFieldProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 280);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useQuery(
    orpc.nasaCommand.searchEntities.queryOptions({
      input: {
        entityType,
        query: debouncedQuery,
        parentId,
      },
    }),
  );

  const results: SearchResult[] = data?.results ?? [];

  const handleSelect = useCallback(
    (item: SearchResult) => {
      setSelectedLabel(item.label);
      setQuery(item.label);
      onChange(item.id, item.label);
      setOpen(false);
    },
    [onChange],
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isSelected = selectedLabel && query === selectedLabel;

  return (
    <div ref={containerRef} className="relative">
      {/* Input */}
      <div
        className={cn(
          "flex items-center gap-2 w-full bg-zinc-800 border rounded-lg px-3 py-2 transition-colors",
          open ? "border-violet-500/60" : "border-zinc-700 hover:border-zinc-600",
        )}
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        <SearchIcon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedLabel("");
            onChange("", e.target.value); // pass raw text until selection
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter" && results[0]) handleSelect(results[0]);
          }}
          placeholder={placeholder ?? `Buscar ${label.toLowerCase()}...`}
          className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 outline-none"
        />
        {isFetching && (
          <span className="text-[10px] text-zinc-600 animate-pulse">buscando...</span>
        )}
        {isSelected && <CheckIcon className="w-3.5 h-3.5 text-violet-400 shrink-0" />}
        {!isSelected && <ChevronDownIcon className="w-3.5 h-3.5 text-zinc-600 shrink-0" />}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700/60 rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto">
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur before click
                handleSelect(item);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-zinc-800 transition-colors",
                value === item.id && "bg-zinc-800",
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{item.label}</p>
                {item.sublabel && (
                  <p className="text-[11px] text-zinc-500 truncate">{item.sublabel}</p>
                )}
              </div>
              {value === item.id && (
                <CheckIcon className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {open && !isFetching && query.length > 0 && results.length === 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700/60 rounded-xl shadow-xl px-3 py-3">
          <p className="text-xs text-zinc-500">Nenhum resultado para "{query}"</p>
        </div>
      )}
    </div>
  );
}

// ─── Plain text field (for date, time, etc.) ──────────────────────────────────

interface PlainFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onEnter?: () => void;
}

export function PlainField({ label, value, onChange, placeholder, onEnter }: PlainFieldProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
      placeholder={placeholder ?? label}
      className="w-full bg-zinc-800 border border-zinc-700 hover:border-zinc-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/60 transition-colors"
    />
  );
}

// ─── Textarea field (for description, notes, etc.) ────────────────────────────

interface TextareaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function TextareaField({ label, value, onChange, placeholder }: TextareaFieldProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? label}
      rows={3}
      className="w-full bg-zinc-800 border border-zinc-700 hover:border-zinc-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/60 transition-colors resize-none"
    />
  );
}

// ─── Date-only picker field ───────────────────────────────────────────────────

interface DatePickerFieldProps {
  value: string; // "YYYY-MM-DD"
  onChange: (value: string) => void;
}

export function DatePickerField({ value, onChange }: DatePickerFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full bg-zinc-800 border border-zinc-700 hover:border-zinc-600 rounded-lg px-3 py-2",
          "text-sm text-white focus:outline-none focus:border-violet-500/60 transition-colors [color-scheme:dark]",
        )}
      />
      {value && (
        <p className="text-[11px] text-zinc-500">
          {new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
            weekday: "long", day: "2-digit", month: "long", year: "numeric",
          })}
        </p>
      )}
    </div>
  );
}

// ─── DateTime picker field ────────────────────────────────────────────────────

interface DateTimePickerFieldProps {
  value: string;         // "YYYY-MM-DDTHH:mm"
  onChange: (value: string) => void;
  onConfirm?: () => void;
}

export function DateTimePickerField({ value, onChange, onConfirm }: DateTimePickerFieldProps) {
  // Valor mínimo: agora (sem segundos)
  const minValue = new Date();
  minValue.setSeconds(0, 0);
  const min = minValue.toISOString().slice(0, 16);

  return (
    <div className="flex flex-col gap-2">
      <input
        type="datetime-local"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && onConfirm) onConfirm(); }}
        className={cn(
          "w-full bg-zinc-800 border border-zinc-700 hover:border-zinc-600 rounded-lg px-3 py-2",
          "text-sm text-white focus:outline-none focus:border-violet-500/60 transition-colors",
          // Estiliza o ícone nativo do datetime-local
          "[color-scheme:dark]",
        )}
      />
      {value && (
        <p className="text-[11px] text-zinc-500">
          {new Date(value).toLocaleDateString("pt-BR", {
            weekday: "long", day: "2-digit", month: "long", year: "numeric",
          })}{" "}
          às{" "}
          {new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
    </div>
  );
}
