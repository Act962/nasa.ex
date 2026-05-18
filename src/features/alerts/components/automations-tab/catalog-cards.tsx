"use client";

import { Bell } from "lucide-react";

interface CatalogEvent {
  key: string;
  label: string;
  description: string;
  appKey: string;
}

interface CatalogCardsProps {
  events: CatalogEvent[];
  loading?: boolean;
  onPick: (eventType: string) => void;
}

/**
 * Grid de cards do catálogo. Cada card representa UM tipo de alerta
 * pré-definido do app selecionado. Click → abre o RuleEditDialog em
 * modo "criar" pré-preenchido com aquele eventType.
 */
export function CatalogCards({ events, loading, onPick }: CatalogCardsProps) {
  if (loading) {
    return (
      <div className="text-xs text-zinc-500">Carregando catálogo…</div>
    );
  }
  if (events.length === 0) {
    return (
      <div className="text-xs text-zinc-500">
        Sem tipos de alerta cadastrados pra esse app ainda.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
        Tipos disponíveis
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {events.map((ev) => (
          <button
            key={ev.key}
            type="button"
            onClick={() => onPick(ev.key)}
            className="text-left rounded-lg border border-zinc-800 bg-zinc-900/40 hover:border-violet-500/50 hover:bg-zinc-900 transition-colors px-3 py-2.5"
          >
            <div className="flex items-start gap-2">
              <Bell className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-zinc-200">
                  {ev.label}
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">
                  {ev.description}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
