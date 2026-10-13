"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { RotateCcwIcon, SendIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { cn } from "@/lib/utils";
import { useSendAttendanceTest } from "../hooks/use-attendance-test";

// Teste do fluxo de atendimento (spec 0089): um celular com a conversa como o cliente veria no
// WhatsApp. Botões e listas seguem o roteiro de verdade; nada é enviado nem gravado.

interface ChatTestAiModalProps {
  trackingId: string;
  assistantName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TestOption {
  id: string;
  title: string;
  description?: string;
}

interface TestBubble {
  from: "client" | "assistant";
  body: string;
  options: TestOption[];
  kind: "menu" | "assistant" | "notice" | "client";
}

const MAX_BUTTONS = 3;

export function ChatTestAiModal({ trackingId, assistantName, open, onOpenChange }: ChatTestAiModalProps) {
  const [bubbles, setBubbles] = useState<TestBubble[]>([]);
  const [draft, setDraft] = useState("");
  const sendTest = useSendAttendanceTest();
  const endOfChatRef = useRef<HTMLDivElement>(null);
  const displayName = assistantName?.trim() || "Assistente";

  useEffect(() => {
    endOfChatRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [bubbles, sendTest.isPending]);

  const send = (text: string, clickId: string | null) => {
    const trimmedText = text.trim();
    if (!trimmedText || sendTest.isPending) return;
    const history = bubbles
      .filter((bubble) => bubble.kind !== "notice")
      .map((bubble) => ({ role: bubble.from, text: bubble.body }));
    setBubbles((current) => [...current, { from: "client", body: trimmedText, options: [], kind: "client" }]);
    setDraft("");
    sendTest.mutate(
      { trackingId, text: trimmedText, clickId, history },
      {
        onSuccess: (result) => {
          setBubbles((current) => [
            ...current,
            ...result.messages.map((message): TestBubble => ({ from: "assistant", ...message })),
          ]);
        },
        onError: (error) => {
          setBubbles((current) => [
            ...current,
            { from: "assistant", body: error.message || "Não foi possível testar agora.", options: [], kind: "notice" },
          ]);
        },
      },
    );
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    send(draft, null);
  };

  const lastBubbleIndex = bubbles.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-3 p-4 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Testar o fluxo de atendimento</DialogTitle>
          <DialogDescription className="text-xs">
            Converse como se fosse o cliente. Nada é enviado ao WhatsApp e nenhum horário é marcado de verdade.
          </DialogDescription>
        </DialogHeader>

        <div className="mx-auto flex min-h-0 w-full max-w-[320px] flex-1 flex-col overflow-hidden rounded-[28px] border-2 border-border bg-background shadow-2xl">
          <div className="flex h-5 items-center justify-center bg-muted">
            <span className="h-1 w-16 rounded-full bg-border" />
          </div>
          <div className="flex items-center gap-2.5 bg-muted px-3 py-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {displayName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="text-[11px] text-muted-foreground">teste · nada é enviado</p>
            </div>
          </div>

          <div className="min-h-[320px] flex-1 space-y-1.5 overflow-y-auto bg-muted/40 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:14px_14px] p-2.5">
            {bubbles.length === 0 && (
              <p className="mx-auto mt-10 max-w-[220px] rounded-lg bg-card px-3 py-2 text-center text-xs text-muted-foreground">
                Mande “oi” para ver o menu, ou escreva uma pergunta de cliente.
              </p>
            )}
            {bubbles.map((bubble, bubbleIndex) => {
              const isClickable = bubbleIndex === lastBubbleIndex && !sendTest.isPending;
              const isList = bubble.options.length > MAX_BUTTONS;
              return (
                <div key={bubbleIndex} className={cn("flex flex-col", bubble.from === "client" ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "max-w-[86%] whitespace-pre-line break-words rounded-lg px-2.5 py-1.5 text-[13px] shadow-sm",
                      bubble.from === "client" && "bg-brand-whatsapp/25",
                      bubble.from === "assistant" && bubble.kind !== "notice" && "bg-card",
                      bubble.kind === "notice" && "border border-warning/30 bg-warning/15 text-warning",
                    )}
                  >
                    {bubble.body}
                  </div>
                  {bubble.options.length > 0 && (
                    <div className={cn("mt-0.5 w-[86%]", isList ? "overflow-hidden rounded-lg bg-card shadow-sm" : "grid gap-0.5")}>
                      {bubble.options.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          disabled={!isClickable}
                          onClick={() => send(option.title, option.id)}
                          className={cn(
                            "w-full text-[13px] transition disabled:opacity-60",
                            isList
                              ? "border-b px-2.5 py-1.5 text-left last:border-b-0 enabled:hover:bg-muted"
                              : "rounded-lg bg-card px-2 py-1.5 text-center font-medium text-info shadow-sm enabled:hover:bg-muted",
                          )}
                        >
                          {option.title}
                          {isList && option.description && (
                            <span className="block text-[11px] text-muted-foreground">{option.description}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {bubble.from === "assistant" && bubble.kind !== "notice" && (
                    <span
                      className={cn(
                        "mt-0.5 rounded-full border px-1.5 text-[10px]",
                        bubble.kind === "assistant" ? "border-primary/40 text-primary" : "text-muted-foreground",
                      )}
                    >
                      {bubble.kind === "assistant" ? "resposta da assistente (usa IA)" : "passo por botão · sem IA"}
                    </span>
                  )}
                </div>
              );
            })}
            {sendTest.isPending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <OrbitaSpinner />
                respondendo…
              </div>
            )}
            <div ref={endOfChatRef} />
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 bg-muted px-2.5 py-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={1500}
              placeholder="Escreva como se fosse o cliente…"
              className="min-w-0 flex-1 rounded-full bg-card px-3 py-1.5 text-[13px] outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={!draft.trim() || sendTest.isPending}
              aria-label="Enviar"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-whatsapp text-white disabled:opacity-50"
            >
              <SendIcon className="size-4" />
            </button>
          </form>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">Pergunta escrita é respondida pela assistente e consome Stars como uma resposta normal.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setBubbles([])} disabled={bubbles.length === 0 || sendTest.isPending}>
            <RotateCcwIcon />
            Recomeçar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
