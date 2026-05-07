"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Wand2 } from "lucide-react";
import { isTextUIPart, type UIMessage } from "ai";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  AstroEmbedScope,
} from "@/features/astro/components/astro-provider";
import { useAstroChat } from "@/features/astro/hooks/use-astro-chat";
import { AstroMessage } from "@/features/astro/components/astro-message";
import { AstroComposer } from "@/features/astro/components/astro-composer";

interface TrackingChatCopilotProps {
  conversationId: string;
  leadId?: string;
  trackingId?: string;
  /** Cola a sugestão final do Closer no draft do tracking-chat. */
  onApplyDraft: (text: string) => void;
}

/**
 * Embed do ASTRO no footer do tracking-chat. Abre num popover, fixa o
 * sub-agente Closer e oferece um atalho "Aplicar" que copia o último
 * texto da resposta para o input principal do chat.
 *
 * Encapsula o `useAstroChat` num <AstroEmbedScope> para isolar a sessão do
 * widget global. Sessão criada aqui é gravada com `context = { scope:
 * "tracking-chat", conversationId }` — não aparece no /home recents.
 */
export function TrackingChatCopilot(props: TrackingChatCopilotProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Abrir ASTRO Closer"
          title="Pedir sugestão do ASTRO"
        >
          <Sparkles className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[420px] p-0"
        sideOffset={8}
      >
        <AstroEmbedScope>
          <CopilotBody {...props} onClose={() => setOpen(false)} />
        </AstroEmbedScope>
      </PopoverContent>
    </Popover>
  );
}

function CopilotBody({
  conversationId,
  leadId,
  trackingId,
  onApplyDraft,
  onClose,
}: TrackingChatCopilotProps & { onClose: () => void }) {
  const { messages, status, sendMessage, stop, error } = useAstroChat({
    pinnedAgentKey: "closer",
    bodyOverride: () => ({
      // Força o context da rota mesmo se o pathname não bater (ex.: ainda
      // dentro do tracking-chat mas o useChat foi montado antes do params
      // resolverem).
      context: { conversationId, leadId, trackingId },
    }),
  });

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  const lastAssistantText = (() => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (!last) return "";
    return last.parts
      .filter(isTextUIPart)
      .map((p) => p.text)
      .join("\n\n")
      .trim();
  })();

  return (
    <div className="flex h-[480px] flex-col">
      <header className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" />
          ASTRO · Closer
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Fechar">
          <X className="size-4" />
        </Button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState
            onPick={(t) => sendMessage({ text: t })}
            disabled={status === "streaming" || status === "submitted"}
          />
        ) : (
          messages.map((m) => <AstroMessage key={m.id} message={m as UIMessage} />)
        )}
        {error && (
          <div className="mx-3 my-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
            {error.message ?? "Erro ao processar."}
          </div>
        )}
      </div>

      {lastAssistantText && (
        <div
          className={cn(
            "flex items-center gap-2 border-t bg-muted/30 px-3 py-2",
          )}
        >
          <Wand2 className="size-3.5 text-primary" />
          <span className="text-xs text-muted-foreground flex-1">
            Aplicar resposta sugerida no input do chat?
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              onApplyDraft(lastAssistantText);
              onClose();
            }}
          >
            Aplicar
          </Button>
        </div>
      )}

      <AstroComposer
        status={status}
        onSend={(text) => sendMessage({ text })}
        onStop={stop}
        placeholder="Peça uma sugestão de resposta…"
      />
    </div>
  );
}

function EmptyState({
  onPick,
  disabled,
}: {
  onPick: (text: string) => void;
  disabled: boolean;
}) {
  const suggestions = [
    "Sugira a próxima resposta com base no histórico",
    "Quebre a última objeção do lead",
    "Proponha tags para classificar este lead",
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
      <Sparkles className="size-7 text-primary" />
      <p className="text-xs text-muted-foreground">
        O Closer lê a conversa e sugere respostas. Escolha um atalho:
      </p>
      <div className="flex w-full flex-col gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            className="rounded-md border bg-background px-3 py-1.5 text-left text-xs hover:bg-muted disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
