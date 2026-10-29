"use client";

import { useState } from "react";
import { Move, RotateCw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DecorPlacementState } from "../engine/decor-layer";
import type { StationDecorItem } from "../hooks/use-orbita-station";
import { AVAILABLE_DECOR, DECOR_CATEGORIES, findDecorItem, type DecorCategory } from "../layout/decor-catalog";
import { MAX_ITEMS_PER_STATION, PLACEMENT_PROBLEM_TEXT } from "../layout/decor-placement";

interface DecorPanelProps {
  items: readonly StationDecorItem[];
  hiddenIds: ReadonlySet<string>;
  selectedId: string | null;
  isBusy: boolean;
  onChoose: (itemKey: string) => void;
  onMove: (item: StationDecorItem) => void;
  onRotate: (item: StationDecorItem) => void;
  onPickUp: (item: StationDecorItem) => void;
  onDeselect: () => void;
  onClose: () => void;
}

/** Modo Decorar (spec 0118, RF-10 e RF-11): o catálogo para escolher e as ações do item clicado na estação. */
export function DecorPanel({ items, hiddenIds, selectedId, isBusy, onChoose, onMove, onRotate, onPickUp, onDeselect, onClose }: DecorPanelProps) {
  const [category, setCategory] = useState<DecorCategory>("sala");
  const selected = selectedId ? items.find((item) => item.id === selectedId) : undefined;
  const hidden = items.filter((item) => hiddenIds.has(item.id));
  const isFull = items.length >= MAX_ITEMS_PER_STATION;

  return (
    <aside className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 max-h-[55dvh] overflow-y-auto rounded-t-2xl bg-black/80 p-5 backdrop-blur sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:max-h-none sm:w-80 sm:rounded-none">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-white/60">Decorar a estação</span>
        <Button size="sm" variant="ghost" className="text-white/80" onClick={onClose}>
          Fechar <X />
        </Button>
      </div>

      {selected ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold leading-tight">{findDecorItem(selected.itemKey)?.name ?? "Item indisponível"}</h2>
          <div className="grid gap-2">
            <Button disabled={isBusy} onClick={() => onMove(selected)}>
              <Move /> Mover
            </Button>
            <Button variant="secondary" disabled={isBusy} onClick={() => onRotate(selected)}>
              <RotateCw /> Girar
            </Button>
            <Button variant="secondary" disabled={isBusy} onClick={() => onPickUp(selected)}>
              <Trash2 /> Tirar da estação
            </Button>
            <Button variant="ghost" className="text-white/80" onClick={onDeselect}>
              Voltar ao catálogo
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-white/70">
            Escolha um item e clique no piso para soltar. <kbd className="rounded bg-white/15 px-1">R</kbd> gira e{" "}
            <kbd className="rounded bg-white/15 px-1">Esc</kbd> cancela. Clique num item da estação para mover ou tirar.
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categorias">
            {DECOR_CATEGORIES.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={category === option.key}
                onClick={() => setCategory(option.key)}
                className={cn("rounded-full px-3 py-1 text-xs font-semibold transition", category === option.key ? "bg-white text-black" : "bg-white/10 hover:bg-white/20")}
              >
                {option.label}
              </button>
            ))}
          </div>
          {isFull && <p className="rounded-xl bg-white/10 p-3 text-sm">A estação já tem {MAX_ITEMS_PER_STATION} itens. Tire algum para colocar outro.</p>}
          <div className="grid grid-cols-2 gap-2">
            {AVAILABLE_DECOR.filter((item) => item.category === category).map((item) => (
              <button
                key={item.key}
                type="button"
                disabled={isFull || isBusy}
                onClick={() => onChoose(item.key)}
                className="rounded-xl bg-white/5 p-3 text-left text-sm font-semibold transition hover:bg-white/15 disabled:opacity-40"
              >
                {item.name}
                <span className="block text-[11px] font-normal text-white/50">Grátis</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-white/45">
            {items.length} de {MAX_ITEMS_PER_STATION} itens na estação.
          </p>
          {hidden.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-white/60">Fora da estação</p>
              <p className="text-xs text-white/60">Estes itens não cabem no modelo de estação atual.</p>
              <ul className="space-y-1">
                {hidden.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{findDecorItem(item.itemKey)?.name ?? "Item indisponível"}</span>
                    <Button size="sm" variant="ghost" className="text-white/80" disabled={isBusy} onClick={() => onPickUp(item)}>
                      Tirar
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </aside>
  );
}

/** Barra da prévia: o que está na mão, se o lugar vale e os botões (no toque, são o único jeito de soltar). */
export function PlacementBar({ state, isBusy, onRotate, onConfirm, onCancel }: { state: DecorPlacementState; isBusy: boolean; onRotate: () => void; onConfirm: () => void; onCancel: () => void }) {
  const item = findDecorItem(state.itemKey);
  return (
    <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-black/70 px-4 py-3 backdrop-blur">
      <div className="min-w-0 text-sm">
        <b>{item?.name}</b>
        <span className={cn("block text-xs", state.problem ? "text-destructive" : "text-success")}>{state.problem ? PLACEMENT_PROBLEM_TEXT[state.problem] : "Lugar livre"}</span>
      </div>
      <Button size="sm" variant="secondary" onClick={onRotate} disabled={isBusy}>
        <RotateCw /> Girar
      </Button>
      <Button size="sm" onClick={onConfirm} disabled={Boolean(state.problem) || isBusy}>
        Soltar aqui
      </Button>
      <Button size="sm" variant="ghost" className="text-white/80" onClick={onCancel}>
        Cancelar
      </Button>
    </div>
  );
}
