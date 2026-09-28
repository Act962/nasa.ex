"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Loader2, MessageCircle, SendHorizonal, X } from "lucide-react";
import { AstroMark } from "@/features/astro/components/astro-mark";
import { cn } from "@/lib/utils";
import type { AssistantContext } from "@/features/trafego/lib/assistant-prompt";

const SUGGESTIONS = [
  "Quanto custa investir R$ 1.000?",
  "Preciso ter conta de anúncios?",
  "Em quanto tempo minha campanha começa?",
  "Posso anunciar meu produto?",
];

/**
 * Astro no site público: tira dúvida de quem está decidindo se contrata.
 *
 * Fica no canto inferior direito, como na plataforma. Manda junto o que o
 * cliente já preencheu no formulário — assim ele responde "quanto vou pagar"
 * sem perguntar de novo o que já está na tela.
 */
export function TrafegoAssistant({ context }: { context: AssistantContext }) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef(context);
  // O botão inteiro é o "corpo" da marca: é ele que treme e esquenta na zanga.
  const discoRef = useRef<HTMLButtonElement>(null);
  contextRef.current = context;

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/trafego/assistant",
      // Lido na hora do envio: o contexto muda conforme o cliente preenche.
      prepareSendMessagesRequest: ({ messages: current }) => ({
        body: { messages: current, context: contextRef.current },
      }),
    }),
  });

  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isBusy]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    setDraft("");
    void sendMessage({ text: trimmed });
  }

  if (!isOpen) {
    return (
      <button
        ref={discoRef}
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Abrir o assistente do trafeGO"
        // Disco escuro atrás da marca: a arte vem com fundo transparente e
        // sumiria sobre as seções claras da landing.
        className="fixed bottom-5 right-5 z-40 grid size-16 place-items-center rounded-full bg-[#0b1220] p-[1.4px] shadow-[0_10px_24px_-6px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.08)_inset] transition-shadow hover:shadow-[0_16px_30px_-8px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.16)_inset] md:right-6"
      >
        <AstroMark vigiaInercia corpo={discoRef} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 z-40 flex h-[80vh] w-full flex-col overflow-hidden border border-white/10 bg-[#0d0d12] shadow-2xl sm:bottom-5 sm:right-5 sm:h-[560px] sm:w-[380px] sm:rounded-2xl md:right-6">
      <header className="flex items-center gap-2.5 border-b border-white/[0.07] px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#0b1220] p-px">
          <AstroMark />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Astro</p>
          <p className="text-[11px] text-white/40">Assistente do trafeGO</p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Fechar"
          className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/[0.06] hover:text-white"
        >
          <X className="size-4" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="rounded-2xl rounded-bl-sm bg-white/[0.06] px-3.5 py-2.5 text-sm text-white/80">
              Oi! Posso explicar como funciona, calcular quanto fica o seu investimento e
              conferir se o que você quer anunciar passa nas regras da plataforma.
            </div>
            <div className="space-y-1.5">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="block w-full rounded-xl border border-white/[0.09] px-3 py-2 text-left text-xs text-white/60 transition hover:border-violet-400/40 hover:text-white"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <Bubble key={message.id} message={message} />
        ))}

        {isBusy && (
          <div className="flex items-center gap-2 text-xs text-white/35">
            <Loader2 className="size-3.5 animate-spin" />
            Pensando…
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            Não consegui responder agora. Tente de novo ou fale com a equipe pelo WhatsApp.
          </p>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
        className="border-t border-white/[0.07] p-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(draft);
              }
            }}
            rows={1}
            placeholder="Escreva sua dúvida…"
            className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-violet-400/60"
          />
          <button
            type="submit"
            disabled={!draft.trim() || isBusy}
            aria-label="Enviar"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-500 disabled:opacity-40"
          >
            <SendHorizonal className="size-4" />
          </button>
        </div>
        <p className="mt-2 flex items-center gap-1 text-[10px] text-white/25">
          <MessageCircle className="size-2.5" />
          Respostas geradas por IA. Não guardamos esta conversa.
        </p>
      </form>
    </div>
  );
}

function Bubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");

  if (!text.trim()) return null;

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-2xl rounded-br-sm bg-violet-600 text-white"
            : "rounded-2xl rounded-bl-sm bg-white/[0.06] text-white/85",
        )}
      >
        {text}
      </div>
    </div>
  );
}
