import React, { useState, useEffect } from "react";
import { Search, Sparkles } from "lucide-react";

export function ThinkingDisplay({ steps }: { steps: string[] }) {
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    if (visibleCount >= steps.length) return;
    const t = setTimeout(() => setVisibleCount((c) => c + 1), 420);
    return () => clearTimeout(t);
  }, [visibleCount, steps.length]);

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="w-9 h-9 rounded-full bg-linear-to-br from-violet-600 to-purple-800 flex items-center justify-center shrink-0 shadow-lg shadow-violet-900/40">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0 bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400 mb-2">
          <Search className="w-3 h-3 shrink-0" />
          <span className="truncate">
            {steps.slice(0, visibleCount).join(" · ")}
          </span>
          {visibleCount < steps.length && (
            <span className="shrink-0 text-zinc-600">
              {visibleCount}/{steps.length} resultados
            </span>
          )}
          {visibleCount >= steps.length && (
            <span className="shrink-0 text-violet-400">✓ concluído</span>
          )}
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
