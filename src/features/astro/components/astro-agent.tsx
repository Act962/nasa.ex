"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  X,
  Minimize2,
  Maximize2,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAstroChat } from "@/features/astro/hooks/use-astro-chat";
import { useAstro } from "@/features/astro/components/astro-provider";
import { AstroMessage } from "@/features/astro/components/astro-message";
import { AstroComposer } from "@/features/astro/components/astro-composer";

/**
 * Widget flutuante global do ASTRO. Substitui o `astro-agent-legacy.tsx`
 * (mantido como referência da UX antiga até confirmação visual). Usa o
 * orquestrador real via `useAstroChat`.
 *
 * Comportamento:
 *   - Botão flutuante fixo no canto inferior direito.
 *   - Click → painel lateral com chat (Sheet "controlado" simples).
 *   - "Maximizar" expande o painel para ~70% da largura.
 *   - "Reset" cria nova sessão (clear `sessionId` no provider) e zera
 *     mensagens locais.
 *
 * Não-objetivos do MVP:
 *   - Lista de histórico (vai estar no `/home` fullscreen).
 *   - Quick replies / actions / integrações (legacy só).
 */
export function AstroAgent() {
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const { setSessionId } = useAstro();

  const { messages, status, sendMessage, stop, error, clearError, setMessages } =
    useAstroChat();

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  function handleReset() {
    setMessages([]);
    setSessionId(null);
    clearError();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir ASTRO"
        className={cn(
          "fixed bottom-4 right-4 z-50 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105",
          open && "scale-95",
        )}
      >
        <Sparkles className="size-5" />
      </button>

      {open && (
        <div
          className={cn(
            "fixed bottom-4 right-4 z-40 flex flex-col rounded-xl border bg-background shadow-2xl transition-[width,height]",
            maximized
              ? "h-[80vh] w-[70vw] max-w-5xl"
              : "h-[600px] w-[400px] max-w-[95vw]",
          )}
          role="dialog"
          aria-label="ASTRO copiloto"
        >
          <header className="flex items-center justify-between border-b px-3 py-2">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <span className="text-sm font-semibold">ASTRO</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                copiloto
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={handleReset}
                aria-label="Nova conversa"
                title="Nova conversa"
              >
                <RotateCcw className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setMaximized((v) => !v)}
                aria-label={maximized ? "Restaurar" : "Maximizar"}
              >
                {maximized ? (
                  <Minimize2 className="size-4" />
                ) : (
                  <Maximize2 className="size-4" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
              >
                <X className="size-4" />
              </Button>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <EmptyState />
            ) : (
              messages.map((m) => <AstroMessage key={m.id} message={m} />)
            )}
            {status === "streaming" && (
              <div className="px-4 py-2 text-xs text-muted-foreground">
                ASTRO está pensando…
              </div>
            )}
            {error && (
              <div className="mx-3 my-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                {error.message ?? "Erro ao processar."}
              </div>
            )}
          </div>

          <AstroComposer
            status={status}
            onSend={(text) => sendMessage({ text })}
            onStop={stop}
          />
        </div>
      )}
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <Sparkles className="size-8 text-primary" />
      <h3 className="text-sm font-semibold">Como posso ajudar?</h3>
      <p className="max-w-xs text-xs text-muted-foreground">
        Peça resumos, crie tarefas, busque leads, sugira respostas a clientes.
        Eu encaminho para o sub-agente certo.
      </p>
    </div>
  );
}
