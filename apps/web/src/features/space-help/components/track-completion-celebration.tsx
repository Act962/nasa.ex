"use client";

import { useEffect } from "react";
import { Award, Sparkles, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  trackTitle?: string;
  starsAwarded?: number;
  spAwarded?: number;
  badge?: { id: string; name: string; iconUrl: string | null; color: string | null } | null;
  onClose: () => void;
}

export function TrackCompletionCelebration({
  trackTitle,
  starsAwarded = 0,
  spAwarded = 0,
  badge,
  onClose,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-muted-foreground hover:bg-muted transition"
          aria-label="Fechar"
        >
          <X className="size-4" />
        </button>

        <div className="relative bg-gradient-to-br from-violet-600 via-fuchsia-600 to-amber-500 p-8 text-white text-center">
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_30%,#fff,transparent_50%),radial-gradient(circle_at_70%_70%,#fff,transparent_40%)]" />
          <div className="relative">
            {badge ? (
              <div
                className="mx-auto flex size-24 items-center justify-center rounded-full shadow-lg ring-4 ring-white/30"
                style={{ backgroundColor: badge.color ?? "#7C3AED" }}
              >
                {badge.iconUrl ? (
                  <img src={badge.iconUrl} alt={badge.name} className="size-16" />
                ) : (
                  <Award className="size-12" />
                )}
              </div>
            ) : (
              <div className="mx-auto flex size-24 items-center justify-center rounded-full bg-white/20 ring-4 ring-white/30">
                <Sparkles className="size-12" />
              </div>
            )}
            <h2 className="mt-4 text-2xl font-bold">Rota concluída!</h2>
            {trackTitle && (
              <p className="mt-1 text-sm text-white/90">{trackTitle}</p>
            )}
          </div>
        </div>

        <div className="p-6 space-y-3">
          {badge && (
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Selo conquistado
              </p>
              <p className="mt-1 text-lg font-bold">{badge.name}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-violet-500/5 p-3 text-center">
              <Sparkles className="size-5 mx-auto text-violet-600" />
              <p className="mt-1 text-2xl font-bold tabular-nums">+{spAwarded}</p>
              <p className="text-[11px] uppercase text-muted-foreground tracking-wider">
                Space Points
              </p>
            </div>
            <div className="rounded-xl border border-border bg-amber-500/5 p-3 text-center">
              <Star className="size-5 mx-auto text-amber-500" />
              <p className="mt-1 text-2xl font-bold tabular-nums">+{starsAwarded}</p>
              <p className="text-[11px] uppercase text-muted-foreground tracking-wider">
                Stars
              </p>
            </div>
          </div>

          <Button onClick={onClose} className="w-full mt-2">
            Continuar
          </Button>
        </div>
      </div>
    </div>
  );
}
