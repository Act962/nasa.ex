"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { UIMessage } from "ai";
import { AstroMessage } from "@/features/astro/components/astro-message";

/** Lista de mensagens do painel, com indicador de digitação e erro legível. */

const TYPING_DOT_DELAYS_MS = [0, 150, 300];

export function AstroWidgetMessages({
  messages,
  loading,
  error,
  onRespond,
  emptyState,
}: {
  messages: UIMessage[];
  loading: boolean;
  error?: Error;
  /** Responde a um cartão de confirmação ("confirmar <id>"). */
  onRespond: (text: string) => void;
  emptyState: ReactNode;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {messages.length === 0 ? (
        emptyState
      ) : (
        <div className="py-2">
          {messages.map((message) => (
            <AstroMessage key={message.id} message={message} onRespond={onRespond} busy={loading} />
          ))}
        </div>
      )}

      {loading && (
        <div role="status" aria-label="Astro está respondendo" className="flex gap-1 px-5 py-3">
          {TYPING_DOT_DELAYS_MS.map((delayMs) => (
            <span
              key={delayMs}
              className="size-1.5 animate-bounce rounded-full bg-white/40"
              style={{ animationDelay: `${delayMs}ms` }}
            />
          ))}
        </div>
      )}

      {error && (
        <p className="mx-4 my-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {describeWidgetError(error)}
        </p>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

/**
 * A rota do chat devolve JSON (`{ error }`) em 401/402; o AI SDK repassa o
 * corpo cru como mensagem. Saldo de Stars é o caso que o usuário precisa ler.
 */
function describeWidgetError(error: Error): string {
  try {
    const parsedBody = JSON.parse(error.message) as { error?: unknown };
    if (typeof parsedBody.error === "string") return parsedBody.error;
  } catch {
    // Não era JSON.
  }
  const hasReadableMessage = error.message.trim().length > 0 && error.message !== "[object Object]";
  return hasReadableMessage
    ? error.message
    : "Não consegui responder agora. Tente de novo em instantes.";
}
