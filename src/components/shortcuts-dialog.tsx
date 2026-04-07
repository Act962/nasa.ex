"use client";

import { useState } from "react";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SHORTCUTS } from "@/features/admin/components/shortcuts-data";

function Key({ label }: { label: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded text-xs font-mono font-medium bg-zinc-800 text-zinc-200 border border-zinc-700 shadow-sm">
      {label}
    </kbd>
  );
}

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const categories = [...new Set(SHORTCUTS.map((s) => s.category))];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" /> Atalhos de Teclado
          </DialogTitle>
          <DialogDescription>
            Navegue pela plataforma usando atalhos globais
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                {category}
              </h3>
              <div className="space-y-2">
                {SHORTCUTS.filter((s) => s.category === category).map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-zinc-900"
                  >
                    <span className="text-zinc-300">{s.description}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k, j) => (
                        <span key={j} className="flex items-center gap-0.5">
                          <Key label={k} />
                          {j < s.keys.length - 1 && (
                            <span className="text-zinc-600 text-xs">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
