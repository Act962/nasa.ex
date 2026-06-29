"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Pencil, Plus, Sparkles, X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

interface SessionHeaderProps {
  sessionId: string | null;
  /** Título atual (recente do query) — pode ser null/"Conversa com ASTRO" até auto-title rodar. */
  title: string | null;
  onNewSession?: () => void;
  /** Refetch da lista após rename pra atualizar o painel histórico. */
  onAfterRename?: () => void;
}

/**
 * Banner discreto acima das mensagens — mostra o título da sessão
 * atual com lápis pra renomear + botão "Nova sessão". Só aparece
 * quando há sessionId ativo.
 *
 * Posição: topo da área de conversa, antes da primeira mensagem.
 */
export function SessionHeader({
  sessionId,
  title,
  onNewSession,
  onAfterRename,
}: SessionHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(title ?? "");
  }, [title]);

  useEffect(() => {
    if (editing) {
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
        console.error("[SessionHeader] falha ao renomear:", err);
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

  if (!sessionId) return null;

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === (title ?? "")) {
      setEditing(false);
      return;
    }
    renameMut.mutate({ id: sessionId, title: trimmed });
  };
  const cancel = () => {
    setDraft(title ?? "");
    setEditing(false);
  };

  return (
    <div className="sticky top-0 z-20 -mx-3 sm:-mx-4 mb-2 px-3 sm:px-4 py-2 border-b border-zinc-800/60 bg-[#050510]/85 backdrop-blur">
      <div className="max-w-3xl mx-auto flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />

        {editing ? (
          <>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") cancel();
              }}
              maxLength={120}
              placeholder="Nome da sessão"
              className="flex-1 bg-transparent text-xs text-zinc-100 outline-none border-b border-violet-500/40 focus:border-violet-400/80 px-0.5 py-0.5"
            />
            <button
              onClick={commit}
              disabled={renameMut.isPending}
              className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50 p-1"
              aria-label="Salvar nome"
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
          </>
        ) : (
          <>
            <span className="flex-1 text-xs text-zinc-300 truncate">
              {title || "Conversa sem título"}
            </span>
            <button
              onClick={() => setEditing(true)}
              className="text-zinc-500 hover:text-violet-300 transition-colors p-1"
              aria-label="Renomear sessão"
              title="Renomear sessão"
            >
              <Pencil className="w-3 h-3" />
            </button>
            {onNewSession && (
              <button
                onClick={onNewSession}
                className="flex items-center gap-1 text-[11px] font-semibold text-violet-300 hover:text-violet-100 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 rounded-md px-2 py-0.5 transition-all"
                title="Iniciar nova sessão"
              >
                <Plus className="w-3 h-3" />
                Nova sessão
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
