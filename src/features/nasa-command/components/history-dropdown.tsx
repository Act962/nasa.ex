"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  History,
  Pencil,
  Check,
  X,
  Trash2,
  Sparkles,
  Plus,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import type { RecentAstroSession } from "./recent-requests";

interface HistoryDropdownProps {
  sessions: RecentAstroSession[];
  loading?: boolean;
  onSelect: (sessionId: string) => void;
  onDelete?: (sessionId: string) => void;
  /** Disparado após rename pra o caller refetchar a lista. */
  onAfterRename?: () => void;
  /** Limpa o chat ativo e prepara nova sessão (cria no envio da 1ª msg). */
  onNewSession?: () => void;
}

/**
 * Toggle "Históricos Astro Explorer" — mesmo padrão visual do
 * <ExampleLibrary>. Mostra as últimas sessões do Astro com:
 *   - Título auto-gerado (App-Data-Entidade) ou customizado pelo user
 *   - Lápis pra editar inline o título
 *   - Lixeira pra apagar
 *   - Tempo desde última atualização
 */
export function HistoryDropdown({
  sessions,
  loading,
  onSelect,
  onDelete,
  onAfterRename,
  onNewSession,
}: HistoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha o popover quando clica fora.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-xs font-semibold text-violet-300 hover:text-violet-200 uppercase tracking-wider transition-colors px-3 py-1.5 rounded-md hover:bg-violet-500/10"
      >
        <History className="w-3.5 h-3.5" />
        Históricos Astro Explorer
        {open ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>

      {open && (
        // Popover absoluto — flutua por cima do conteúdo. Antes era inline
        // (mt-4 dentro do flex) e empurrava o layout do composer pra cima.
        // Ancorado pelo top do botão; max-height + overflow pra não estourar
        // a tela. z-50 fica acima da bolha de mensagens.
        <div className="absolute top-full right-0 mt-2 w-[min(420px,calc(100vw-2rem))] max-h-[60vh] overflow-y-auto rounded-lg border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md shadow-2xl shadow-black/40 z-50 p-2 space-y-1.5">
          {/* Botão "Nova sessão" — limpa o chat ativo e prepara um novo
              AiSession (criado server-side no envio da próxima mensagem). */}
          {onNewSession && (
            <button
              onClick={() => {
                onNewSession();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 hover:border-violet-500/60 text-violet-300 hover:text-violet-100 rounded-lg px-3 py-2 transition-all text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova sessão
            </button>
          )}
          {/* Divisor visual entre o CTA e a lista — só aparece se houver sessões. */}
          {onNewSession && sessions.length > 0 && (
            <div className="border-t border-zinc-800/60 my-1" />
          )}
          {loading && (
            <div className="text-xs text-zinc-600 px-2 py-1">
              Carregando histórico…
            </div>
          )}
          {!loading && sessions.length === 0 && (
            <div className="text-xs text-zinc-600 px-2 py-1">
              Sem conversas ainda. Mande uma mensagem pra começar.
            </div>
          )}
          {sessions.map((s) => (
            <HistoryRow
              key={s.id}
              session={s}
              onSelect={(id) => {
                onSelect(id);
                setOpen(false);
              }}
              onDelete={onDelete}
              onAfterRename={onAfterRename}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryRow({
  session,
  onSelect,
  onDelete,
  onAfterRename,
}: {
  session: RecentAstroSession;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  onAfterRename?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.title ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      // Foco + select all assim que vira input.
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [editing]);

  const renameMut = useMutation(
    orpc.astro.sessions.updateTitle.mutationOptions({
      onSuccess: () => {
        setEditing(false);
        onAfterRename?.();
      },
      onError: (err) => {
        console.error("[HistoryDropdown] falha ao renomear:", err);
        // Mostra erro visível pro user — sem isso o estado fica preso em
        // editing=true e ele não entende o que aconteceu.
        if (typeof window !== "undefined") {
          window.alert(
            `Erro ao renomear: ${
              err instanceof Error ? err.message : "desconhecido"
            }`,
          );
        }
      },
    }),
  );

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(session.title ?? "");
    setEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === session.title) {
      setEditing(false);
      return;
    }
    renameMut.mutate({ id: session.id, title: trimmed });
  };

  const cancel = () => {
    setDraft(session.title ?? "");
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="w-full flex items-center gap-1 bg-zinc-900/40 border border-violet-500/40 rounded-lg px-3 py-2">
        <Sparkles className="w-3 h-3 text-violet-400 shrink-0" />
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          maxLength={120}
          className="flex-1 bg-transparent text-xs text-zinc-100 outline-none border-none placeholder:text-zinc-600"
          placeholder="Nome da conversa"
        />
        <button
          onClick={commit}
          disabled={renameMut.isPending}
          className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50 p-1"
          aria-label="Salvar título"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={cancel}
          className="text-zinc-500 hover:text-zinc-300 p-1"
          aria-label="Cancelar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex items-center gap-1 bg-zinc-900/40 hover:bg-zinc-800/70 border border-zinc-800/60 hover:border-zinc-700 rounded-lg px-3 py-2 transition-all group">
      <button
        onClick={() => onSelect(session.id)}
        className="flex-1 text-left flex items-center gap-2.5 min-w-0"
      >
        <Sparkles className="w-3 h-3 text-zinc-600 group-hover:text-violet-400 shrink-0 transition-colors" />
        <span className="flex-1 text-xs text-zinc-400 group-hover:text-zinc-200 truncate transition-colors">
          {session.title || "Conversa sem título"}
        </span>
        <span className="text-[10px] text-zinc-600 shrink-0">
          {formatDistanceToNow(new Date(session.updatedAt), {
            locale: ptBR,
            addSuffix: true,
          })}
        </span>
      </button>
      <button
        onClick={startEdit}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-violet-400 p-1"
        aria-label="Editar título"
      >
        <Pencil className="w-3 h-3" />
      </button>
      {onDelete && (
        <button
          onClick={() => onDelete(session.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-rose-400 p-1"
          aria-label="Apagar conversa"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
