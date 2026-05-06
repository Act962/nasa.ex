"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { client, orpc } from "@/lib/orpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";
import { useAstroMetaContext } from "@/features/astro/hooks/use-astro-meta-context";
import { AstroActiveCampaignChip } from "./active-campaign-chip";
import { AstroCampaignPicker } from "./campaign-picker";
import { AstroActionCard } from "./action-card";
import { AstroUnauthorizedCard } from "@/features/insights/components/astro-unauthorized-card";

/**
 * Prompt bar do Astro — input + render de respostas streamadas + tool outputs.
 *
 * Embedável em qualquer surface:
 *   <AstroPromptBar context="insights" workspaceId={...} columnId={...} />
 *
 * Integra com `useAstroMetaContext` pra ler/setar `activeCampaign` e passa
 * isso pro backend via `activeMetaCampaignId/Name`. Isso permite que tools
 * de gestão (pause, update, etc.) operem na campanha em foco.
 *
 * Tool outputs reconhecidos:
 *  - `requiresCampaignSelection: true, campaigns: [...]` → renderiza picker
 *  - `requiresConfirmation: true, pendingActionId, summary` → renderiza action-card
 *  - `error: "unauthorized" | ...` → renderiza unauthorized-card
 */

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  toolOutputs?: ToolOutput[];
};

type ToolOutput =
  | {
      kind: "campaign-picker";
      campaigns: Array<{
        metaCampaignId: string;
        name: string;
        status?: string;
        dailyBudgetReais?: number;
        objective?: string;
        effectiveStatus?: string;
      }>;
    }
  | {
      kind: "action-card";
      pendingActionId: string;
      summary: string;
      tool: string;
    }
  | { kind: "unauthorized"; reason: string; message: string };

export function AstroPromptBar({
  context,
  workspaceId: workspaceIdProp,
  columnId,
  placeholder,
  className,
}: {
  context: "insights" | "planner" | "explorer" | "floating";
  /** Quando omitido, auto-resolve pra primeira workspace do user. */
  workspaceId?: string;
  columnId?: string;
  placeholder?: string;
  className?: string;
}) {
  const { activeCampaign, scope } = useAstroMetaContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-resolve workspace se não foi passado (insights/relatorios não tem)
  const { data: wsList } = useQuery({
    ...orpc.workspace.list.queryOptions({ input: {} }),
    enabled: !workspaceIdProp,
  });
  const workspaceId =
    workspaceIdProp ??
    (Array.isArray((wsList as any)?.workspaces)
      ? (wsList as any).workspaces[0]?.id
      : Array.isArray(wsList)
        ? (wsList as any[])[0]?.id
        : undefined);

  // Auto-scroll quando mensagens novas chegam
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || streaming) return;
      if (!workspaceId) {
        setMessages((m) => [
          ...m,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            text: "Você precisa ter pelo menos um workspace pra usar o Astro. Crie um em /workspace e tente novamente.",
          },
        ]);
        return;
      }

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        text,
      };
      const asstId = `a-${Date.now()}`;
      setMessages((m) => [...m, userMsg, { id: asstId, role: "assistant", text: "" }]);
      setStreaming(true);

      try {
        const stream = await (client as any).ia.workspace.chat({
          messages: [
            ...messages.map((m) => ({
              id: m.id,
              role: m.role,
              parts: [{ type: "text", text: m.text }],
            })),
            { id: userMsg.id, role: "user", parts: [{ type: "text", text }] },
          ],
          initialWorkspaceId: workspaceId,
          initialColumnId: columnId,
          activeMetaCampaignId:
            scope === "single" ? activeCampaign?.metaCampaignId : undefined,
          activeMetaCampaignName:
            scope === "single" ? activeCampaign?.name : undefined,
        });

        let acc = "";
        const toolOutputs: ToolOutput[] = [];

        for await (const event of stream) {
          // AI SDK v6 emite eventos UIMessageStreamPart:
          //   - text-delta              { delta: string }
          //   - tool-output-available   { toolCallId, output }   ← result
          //   - tool-output-error       { errorText }
          const t = (event as any)?.type;
          if (t === "text-delta") {
            acc += (event as any).delta ?? (event as any).textDelta ?? "";
          } else if (
            t === "tool-output-available" ||
            t === "tool-result" || // backwards compat
            t === "tool-output"
          ) {
            const out =
              (event as any).output ??
              (event as any).result ??
              (event as any).value;
            const interpreted = interpretToolOutput(out);
            if (interpreted) toolOutputs.push(interpreted);
          }
          setMessages((m) =>
            m.map((msg) =>
              msg.id === asstId
                ? { ...msg, text: acc, toolOutputs: toolOutputs.length ? toolOutputs : undefined }
                : msg,
            ),
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        setMessages((m) =>
          m.map((it) => (it.id === asstId ? { ...it, text: `❌ ${msg}` } : it)),
        );
      } finally {
        setStreaming(false);
      }
    },
    [streaming, messages, scope, activeCampaign, workspaceId, columnId],
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await sendMessage(text);
  }, [input, sendMessage]);

  return (
    <Card className={className}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Bot className="size-3.5" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">Astro</p>
              <p className="text-[10px] text-muted-foreground">
                {context === "insights"
                  ? "Pergunte sobre Meta Ads ou peça uma ação"
                  : context === "planner"
                    ? "Crie campanhas a partir do conteúdo"
                    : "Pergunte ou peça uma ação"}
              </p>
            </div>
          </div>
          <AstroActiveCampaignChip />
        </div>

        {/* Mensagens */}
        {messages.length > 0 && (
          <div
            ref={scrollRef}
            className="max-h-[400px] overflow-y-auto space-y-3 border-t pt-3"
          >
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                streaming={streaming}
                onCampaignSelect={sendMessage}
              />
            ))}
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 border rounded-lg px-3 py-2"
        >
          <Sparkles className="size-3.5 text-primary shrink-0" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              placeholder ?? "Pergunte ao Astro... (ex: 'pausa minha campanha de Black Friday')"
            }
            disabled={streaming}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            disabled={!input.trim() || streaming}
            className="size-7 shrink-0"
          >
            {streaming ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Message bubble ────────────────────────────────────────────────────────

function MessageBubble({
  message,
  streaming,
  onCampaignSelect,
}: {
  message: Message;
  streaming: boolean;
  onCampaignSelect?: (label: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-3 py-1.5 text-xs">
          {message.text}
        </div>
      </div>
    );
  }
  const empty = !message.text && (!message.toolOutputs || message.toolOutputs.length === 0);
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-2">
        {empty && streaming ? (
          <Skeleton className="h-4 w-32" />
        ) : (
          message.text && (
            <div className="bg-muted/50 rounded-2xl rounded-bl-sm px-3 py-1.5 text-xs whitespace-pre-wrap">
              {message.text}
            </div>
          )
        )}
        {message.toolOutputs?.map((out, idx) => (
          <ToolOutputRenderer
            key={idx}
            output={out}
            onCampaignSelect={onCampaignSelect}
          />
        ))}
      </div>
    </div>
  );
}

function ToolOutputRenderer({
  output,
  onCampaignSelect,
}: {
  output: ToolOutput;
  onCampaignSelect?: (label: string) => void;
}) {
  if (output.kind === "campaign-picker") {
    return (
      <AstroCampaignPicker
        campaigns={output.campaigns}
        onSelect={(c) => {
          if (c === "all") {
            onCampaignSelect?.("Trabalhar com TODAS as campanhas");
          } else {
            onCampaignSelect?.(`Selecionei: ${c.name}. Pode continuar.`);
          }
        }}
      />
    );
  }
  if (output.kind === "action-card") {
    return (
      <AstroActionCard
        pendingActionId={output.pendingActionId}
        summary={output.summary}
        toolName={output.tool}
      />
    );
  }
  if (output.kind === "unauthorized") {
    return <AstroUnauthorizedCard reason={output.reason} message={output.message} />;
  }
  return null;
}

// ─── Tool output interpreter ──────────────────────────────────────────────

function interpretToolOutput(out: unknown): ToolOutput | null {
  if (!out || typeof out !== "object") return null;
  const o = out as Record<string, unknown>;

  if (o.requiresCampaignSelection && Array.isArray(o.campaigns)) {
    return {
      kind: "campaign-picker",
      campaigns: o.campaigns as ToolOutput extends { kind: "campaign-picker" }
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any
        : never,
    };
  }
  if (
    o.requiresConfirmation &&
    typeof o.pendingActionId === "string" &&
    typeof o.summary === "string"
  ) {
    return {
      kind: "action-card",
      pendingActionId: o.pendingActionId,
      summary: o.summary,
      tool: typeof o.tool === "string" ? o.tool : "",
    };
  }
  if (o.error === "unauthorized" || o.error === "no_meta_auth") {
    return {
      kind: "unauthorized",
      reason: typeof o.error === "string" ? o.error : "unauthorized",
      message: typeof o.message === "string" ? o.message : "Não autorizado.",
    };
  }
  return null;
}
