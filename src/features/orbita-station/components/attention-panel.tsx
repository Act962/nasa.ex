"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AttentionItem } from "./room-indicators";

/** "O que pede atenção" (spec 0121, RF-9): o que está pendente nos módulos. Cada item leva até a sala dele. */
export function AttentionPanel({
  items,
  updatedAt,
  isStale,
  onPick,
  onClose,
}: {
  items: AttentionItem[];
  updatedAt: string | null;
  isStale: boolean;
  onPick: (item: AttentionItem) => void;
  onClose: () => void;
}) {
  return (
    <aside className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 max-h-[70dvh] overflow-y-auto rounded-t-2xl bg-black/80 p-5 backdrop-blur sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:max-h-none sm:w-80 sm:rounded-none">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-white/60">O que pede atenção</span>
        <Button size="sm" variant="ghost" className="text-white/80" onClick={onClose}>
          Fechar <X />
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-white/70">Nada pendente nos módulos que você acompanha.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => onPick(item)}
                className={cn("w-full rounded-xl border-l-4 bg-white/5 p-3 text-left transition hover:bg-white/10", item.isUrgent ? "border-destructive" : "border-warning")}
              >
                <span className="block text-sm font-semibold">{item.title}</span>
                <span className="block text-xs text-white/60">{item.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {updatedAt && (
        <p className="mt-4 text-[11px] text-white/45">
          {isStale ? "Sem conexão: dados de " : "Atualizado às "}
          {new Date(updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
    </aside>
  );
}
