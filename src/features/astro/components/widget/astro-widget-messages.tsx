"use client";

import { Fragment, useEffect, useRef, type ReactNode } from "react";
import type { UIMessage } from "ai";
import { AstroMessage } from "@/features/astro/components/astro-message";
import { AstroPrivacyConsentCard } from "./astro-privacy-consent-card";

/** Lista de mensagens do painel, abaixo da abertura do App, com indicador de digitação e erro legível. */

const TYPING_DOT_DELAYS_MS = [0, 150, 300];

export function AstroWidgetMessages({
  messages,
  loading,
  error,
  onRespond,
  introduction,
  renderAfterMessageCount,
  sessionId,
}: {
  messages: UIMessage[];
  sessionId?: string;
  loading: boolean;
  error?: Error;
  /** Responde a um cartão de confirmação ("confirmar <id>"). */
  onRespond: (text: string) => void;
  /** Abertura do App (sugestões e mensagens do Astro): fica sempre em cima, também depois que a conversa começa. */
  introduction: ReactNode;
  /** Conteúdo encaixado depois da N-ésima mensagem (ex.: o Astro falando do App para onde o usuário foi). */
  renderAfterMessageCount?: (messageCount: number) => ReactNode;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Desce até perto da caixa de texto sempre que algo novo cresce a conversa: resposta, "digitando", troca de App.
  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;
    let lastHeight = contentElement.offsetHeight;
    const observer = new ResizeObserver(() => {
      const currentHeight = contentElement.offsetHeight;
      if (currentHeight > lastHeight) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      lastHeight = currentHeight;
    });
    observer.observe(contentElement);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div ref={contentRef} className="flex min-h-full flex-col">
      <AstroPrivacyConsentCard />
      {introduction}
      {renderAfterMessageCount?.(0)}
      {messages.length > 0 && (
        <div className="py-2">
          {messages.map((message, index) => (
            <Fragment key={message.id}>
              <AstroMessage
                message={message}
                onRespond={onRespond}
                busy={loading}
                sessionId={sessionId}
                isLatest={index === messages.length - 1}
              />
              {renderAfterMessageCount?.(index + 1)}
            </Fragment>
          ))}
        </div>
      )}

      {loading && (
        <div role="status" aria-label="Astro está respondendo" className="flex gap-1 px-5 py-3">
          {TYPING_DOT_DELAYS_MS.map((delayMs) => (
            <span
              key={delayMs}
              className="size-1.5 animate-bounce rounded-full bg-foreground/40"
              style={{ animationDelay: `${delayMs}ms` }}
            />
          ))}
        </div>
      )}

      {error && (
        <p className="mx-4 my-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {describeWidgetError(error)}
        </p>
      )}

      <div ref={bottomRef} />
      </div>
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
