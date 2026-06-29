"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Wand2 } from "lucide-react";
import {
  isTextUIPart,
  isToolUIPart,
  getToolName,
  type UIMessage,
  type ToolUIPart,
  type DynamicToolUIPart,
} from "ai";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { AstroEmbedScope } from "@/features/astro/components/astro-provider";
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
      <PopoverContent align="end" className="w-[420px] p-0" sideOffset={8}>
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

  // `sendMessage` é async (faz ensureSession antes do POST). Durante esse
  // gap, `messages` ainda está vazio e `status` ainda é "ready" — sem isso
  // o user clica e fica olhando pro EmptyState congelado. `isPreparing`
  // segura o "Pensando…" da hora do clique até a chamada terminar.
  const [isPreparing, setIsPreparing] = useState(false);
  const isBusy =
    isPreparing || status === "submitted" || status === "streaming";

  const handleSend = (text: string) => {
    setIsPreparing(true);
    void Promise.resolve(sendMessage({ text })).finally(() =>
      setIsPreparing(false),
    );
  };

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status, isBusy]);

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
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X className="size-4" />
        </Button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 && !isBusy ? (
          <EmptyState onPick={handleSend} disabled={isBusy} />
        ) : (
          messages.map((m) => (
            <AstroMessage key={m.id} message={m as UIMessage} />
          ))
        )}
        {isBusy && (
          <ThinkingIndicator
            hint={deriveThinkingHint(messages as UIMessage[])}
          />
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
        onSend={handleSend}
        onStop={stop}
        placeholder="Peça uma sugestão de resposta…"
      />
    </div>
  );
}

/**
 * Mapa tool name → hint pro usuário. Mostra o que o Closer está fazendo
 * agora pra a espera não parecer congelada. Toda tool nova do Closer que
 * impactar UX visível aqui deve ganhar uma entrada.
 */
const TOOL_HINTS: Record<string, string> = {
  get_conversation: "Lendo a conversa…",
  list_taggable_tags: "Carregando catálogo de tags…",
  propose_tags_for_lead: "Selecionando tags relevantes…",
  search_lead: "Buscando dados do lead…",
  update_lead_tags: "Aplicando tags…",
  search_knowledge: "Buscando base de conhecimento…",
};

/** Detecta a última tool em execução pra dar feedback contextual. */
function deriveThinkingHint(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || m.role !== "assistant") continue;
    for (let j = m.parts.length - 1; j >= 0; j--) {
      const part = m.parts[j];
      if (!part || !isToolUIPart(part)) continue;
      const name = getToolName(part as ToolUIPart | DynamicToolUIPart);
      const hint = TOOL_HINTS[name];
      if (hint) return hint;
    }
    break;
  }
  return "ASTRO está pensando…";
}

function ThinkingIndicator({ hint }: { hint: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
      <span className="flex gap-0.5" aria-hidden>
        <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-current" />
      </span>
      <span>{hint}</span>
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
    "Propor tags para este lead com base nos últimos 7 dias de conversa",
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
