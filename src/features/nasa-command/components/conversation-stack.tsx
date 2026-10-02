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
  const bottomRef = useRef<HTMLDivElement>(null);

  const lastMessage = messages.at(-1);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, loading]);

  return (
    <div className="pb-2">
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
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
