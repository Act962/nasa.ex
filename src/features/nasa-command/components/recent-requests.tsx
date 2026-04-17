import React from "react";
import { BarChart3, Search } from "lucide-react";

interface RecentRequestsProps {
  onSelect: (cmd: string) => void;
  recent: string[];
  onClear: () => void;
}

export function RecentRequests({ onSelect, recent, onClear }: RecentRequestsProps) {
  if (recent.length === 0) return null;

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-xl">
        <span className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          <Search className="w-3.5 h-3.5" />
          Últimas solicitações
        </span>
        <button
          onClick={onClear}
          className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Limpar
        </button>
      </div>
      <div className="w-full max-w-xl space-y-1.5">
        {recent.map((cmd, i) => (
          <button
            key={i}
            onClick={() => onSelect(cmd)}
            className="w-full text-left flex items-center gap-2.5 bg-zinc-900/40 hover:bg-zinc-800/70 border border-zinc-800/60 hover:border-zinc-700 rounded-lg px-3 py-2 transition-all group"
          >
            <BarChart3 className="w-3 h-3 text-zinc-600 group-hover:text-violet-400 shrink-0 transition-colors" />
            <span className="text-xs text-zinc-500 group-hover:text-zinc-200 truncate transition-colors">
              {cmd}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
