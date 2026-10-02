import React from "react";
import { Sparkles, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface RecentAstroSession {
  id: string;
  title: string | null;
  lastAgentKey: string | null;
  updatedAt: Date | string;
}

interface RecentRequestsProps {
  onSelect: (sessionId: string) => void;
  /** Sessões livres (não-embeds) do usuário. */
  sessions: RecentAstroSession[];
  /** Remove uma sessão específica. */
  onDelete?: (sessionId: string) => void;
  loading?: boolean;
}

/**
 * Lista de sessões recentes do ASTRO no `/home`. Substitui o storage
 * local-only por queries reais em `AiSession` (oRPC).
 */
export function RecentRequests({
  onSelect,
  sessions,
  onDelete,
  loading,
}: RecentRequestsProps) {
  if (loading) {
    return (
      <div className="w-full max-w-xl text-xs text-muted-foreground">
        Carregando histórico…
      </div>
    );
  }
  if (sessions.length === 0) return null;

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-xl">
        <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          Conversas recentes
        </span>
      </div>
      <div className="w-full max-w-xl space-y-1.5">
        {sessions.map((s) => (
          <div
            key={s.id}
            className="w-full flex items-center gap-1 bg-card/40 hover:bg-card/70 border border-line/60 hover:border-line rounded-lg px-3 py-2 transition-all group"
          >
            <button
              onClick={() => onSelect(s.id)}
              className="flex-1 text-left flex items-center gap-2.5"
            >
              <Sparkles className="w-3 h-3 text-muted-foreground group-hover:text-info shrink-0 transition-colors" />
              <span className="flex-1 text-xs text-muted-foreground group-hover:text-foreground truncate transition-colors">
                {s.title || "Conversa sem título"}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {formatDistanceToNow(new Date(s.updatedAt), {
                  locale: ptBR,
                  addSuffix: true,
                })}
              </span>
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(s.id)}
                className="hover-reveal text-muted-foreground hover:text-destructive p-1"
                aria-label="Apagar conversa"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
