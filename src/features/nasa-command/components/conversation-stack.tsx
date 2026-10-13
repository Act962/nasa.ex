"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { AstroMessage } from "@/features/astro/components/astro-message";
import { AstroWidgetApprovals } from "@/features/astro-commander/components/astro-widget-approvals";
import { ThinkingDisplay, type ThinkingStep } from "./thinking-display";

/** Conversa da Início acima da caixa: balões abertos direto sobre o céu, até o usuário começar outra conversa. */

interface ConversationStackProps {
  messages: UIMessage[];
  loading: boolean;
  thinkingSteps: ThinkingStep[];
  error?: Error;
  sessionId?: string | null;
  onRespond: (text: string) => void;
}

export function ConversationStack({
  messages,
  loading,
  thinkingSteps,
  error,
  sessionId,
  onRespond,
}: ConversationStackProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const lastMessage = messages.at(-1);

  // O cartão de pergunta cresce depois de montado (lista de pessoas, seletor de data): rolar só na
  // chegada da mensagem deixava a pergunta nova escondida embaixo. Mesmo padrão do widget do Astro.
  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;
    // A caixa de texto fica presa embaixo e cobre o fim da conversa: scrollIntoView dava a pergunta
    // por visível atrás dela. Ir ao fim da área de rolagem deixa a caixa depois da conversa.
    const scrollArea = contentElement.closest<HTMLElement>("[data-home-scroll]");
    if (!scrollArea) return;
    let lastScrollHeight = 0;
    const observer = new ResizeObserver(() => {
      const currentScrollHeight = scrollArea.scrollHeight;
      if (currentScrollHeight > lastScrollHeight) {
        scrollArea.scrollTo({ top: currentScrollHeight, behavior: "smooth" });
      }
      lastScrollHeight = currentScrollHeight;
    });
    observer.observe(contentElement);
    if (scrollArea.firstElementChild) observer.observe(scrollArea.firstElementChild);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={contentRef} className="pb-2">
      <div className="space-y-0.5">
        <AstroWidgetApprovals surface="theme" />
        {messages.map((message) => (
          <AstroMessage
            key={message.id}
            message={message}
            onRespond={onRespond}
            busy={loading}
            sessionId={sessionId ?? undefined}
            isLatest={message.id === lastMessage?.id}
            isCompact
          />
        ))}
        {loading && <ThinkingDisplay steps={thinkingSteps} />}
        {error && (
          <div className="rounded-[14px] bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error.message || "Erro ao processar."}
          </div>
        )}
      </div>
    </div>
  );
}
