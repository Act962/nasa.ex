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
    <div className="sticky top-0 z-20 -mx-3 sm:-mx-4 mb-2 px-3 sm:px-4 py-2 bg-background/85 backdrop-blur">
      <div className="max-w-3xl mx-auto flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-info shrink-0" />

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
              className="flex-1 bg-transparent text-xs text-foreground outline-none border-b border-info/40 focus:border-info/80 px-0.5 py-0.5"
            />
            <button
              onClick={commit}
              disabled={renameMut.isPending}
              className="text-success hover:text-success disabled:opacity-50 p-1"
              aria-label="Salvar nome"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={cancel}
              className="text-muted-foreground hover:text-muted-foreground p-1"
              aria-label="Cancelar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 text-xs text-muted-foreground truncate">
              {title || "Conversa sem título"}
            </span>
            <button
              onClick={() => setEditing(true)}
              className="text-muted-foreground hover:text-info transition-colors p-1"
              aria-label="Renomear sessão"
              title="Renomear sessão"
            >
              <Pencil className="w-3 h-3" />
            </button>
            {onNewSession && (
              <button
                onClick={onNewSession}
                className="flex items-center gap-1 text-[11px] font-semibold text-info hover:text-info bg-info/10 hover:bg-info/20 border border-info/30 rounded-md px-2 py-0.5 transition-all"
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
