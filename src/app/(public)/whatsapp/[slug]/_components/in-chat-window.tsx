"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SendIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { pusherClient } from "@/lib/pusher";

/**
 * Janela do In-Chat (cliente). UI WhatsApp-like — header com avatar +
 * nome da org, área de mensagens com bolhas verde/branca, composer com
 * textarea + botão enviar.
 *
 * Real-time via Pusher (canal público nomeado pelo `conversationId`, que
 * é cuid de 25 chars unguessable). Polling de 30s como safety net pra
 * pegar mensagens que perderam pela conexão Pusher cair.
 *
 * Status checks (✓✓) não aparecem aqui porque o lead é o "lead da
 * conversa" — sempre own perspective do lado oposto do atendente.
 */

interface Message {
  id: string;
  messageId: string;
  body: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  mimetype: string | null;
  fileName: string | null;
  createdAt: string;
  fromMe: boolean;
  status: string;
  senderName: string | null;
  viaInChat: boolean;
}

// Safety net — caso o Pusher caia, refaz fetch full a cada 30s. Mais
// econômico que polling de 5s e cobre falhas raras.
const SAFETY_POLL_MS = 30_000;

export function InChatWindow({
  slug,
  orgName,
  orgLogo,
}: {
  slug: string;
  orgName: string;
  orgLogo: string | null;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial load + safety polling
  useEffect(() => {
    let cancelled = false;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/in-chat/${slug}/messages`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          items: Message[];
          conversationId: string;
        };
        if (cancelled) return;
        // API retorna em ordem desc — mostramos asc no chat.
        const ordered = [...data.items].reverse();
        setMessages(ordered);
        setConversationId(data.conversationId);
      } catch {
        // Silencioso — Pusher cobre real-time; safety poll cobre fallback.
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, SAFETY_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [slug]);

  // Real-time via Pusher — escuta mensagens criadas pelo atendente
  // (`message:created` / `message:new`) e atualizações (`message:updated`,
  // ex: status SEEN ou DELETED).
  useEffect(() => {
    if (!conversationId) return;

    const channel = pusherClient.subscribe(conversationId);

    const upsertMessage = (incoming: Message & { id: string }) => {
      setMessages((prev) => {
        // Dedup por messageId/id — se já existe (otimista nosso), atualiza
        if (prev.some((m) => m.id === incoming.id)) {
          return prev.map((m) => (m.id === incoming.id ? incoming : m));
        }
        return [...prev, incoming];
      });
    };

    const handleCreated = (payload: any) => {
      if (payload?.id) upsertMessage(payload as Message);
    };
    const handleNew = (payload: any) => {
      if (payload?.id) upsertMessage(payload as Message);
    };
    const handleUpdated = (payload: any) => {
      if (!payload?.messageId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId
            ? { ...m, status: payload.status ?? m.status }
            : m,
        ),
      );
    };

    channel.bind("message:created", handleCreated);
    channel.bind("message:new", handleNew);
    channel.bind("message:updated", handleUpdated);

    return () => {
      channel.unbind("message:created", handleCreated);
      channel.unbind("message:new", handleNew);
      channel.unbind("message:updated", handleUpdated);
      pusherClient.unsubscribe(conversationId);
    };
  }, [conversationId]);

  // Auto-scroll pro final quando há mensagem nova.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);

    // Optimistic message — aparece imediatamente, depois é substituída
    // pela versão real do servidor.
    const tempId = `optimistic-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      messageId: tempId,
      body: text,
      mediaUrl: null,
      mediaType: null,
      mimetype: null,
      fileName: null,
      createdAt: new Date().toISOString(),
      fromMe: false, // do ponto de vista do BANCO: lead = !fromMe
      status: "SENT",
      senderName: null,
      viaInChat: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");

    try {
      const res = await fetch(`/api/in-chat/${slug}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: text }),
      });
      if (!res.ok) throw new Error("send failed");
      const { message } = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? message : m)),
      );
    } catch {
      // Rollback do otimista + reexibe no draft pro user tentar de novo.
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#dbe9f7] dark:bg-zinc-900">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-800 border-b shadow-sm px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        {orgLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={orgLogo}
            alt={orgName}
            className="size-10 rounded-full object-cover"
          />
        ) : (
          <div className="size-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-semibold">
            {orgName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{orgName}</p>
          <p className="text-[10px] text-zinc-500">Atendimento via WhatsApp</p>
        </div>
      </header>

      {/* Mensagens */}
      <div
        ref={scrollRef}
        className={cn(
          "flex-1 overflow-y-auto p-4 space-y-2",
          "bg-[url('/chat-bg/mobile.svg')] md:bg-[url('/chat-bg/desktop.svg')]",
          "bg-cover bg-center bg-fixed",
        )}
      >
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-xs text-zinc-500">
            Nenhuma mensagem ainda. Diga olá!
          </div>
        )}
        {messages.map((msg, i) => {
          // No In-Chat o lead é "ele mesmo" — então mensagens do
          // ATENDENTE (que no DB têm `fromMe: true`) vêm da ESQUERDA pra
          // ele, e mensagens dele próprio (DB `fromMe: false`) vão pra
          // DIREITA. Invertemos a lógica visual aqui.
          const isOwnFromLead = !msg.fromMe;
          const prev = messages[i - 1];
          const showDateHeader =
            !prev ||
            new Date(msg.createdAt).toDateString() !==
              new Date(prev.createdAt).toDateString();

          return (
            <div key={msg.id}>
              {showDateHeader && (
                <div className="flex justify-center my-3">
                  <span className="bg-white/80 dark:bg-zinc-800/80 text-[10px] font-medium px-2 py-1 rounded-md shadow uppercase text-zinc-700 dark:text-zinc-200">
                    {formatDateHeader(msg.createdAt)}
                  </span>
                </div>
              )}
              <div
                className={cn("flex", isOwnFromLead && "justify-end")}
              >
                <div
                  className={cn(
                    "relative max-w-[85%] text-sm rounded-lg px-2 py-1 shadow-sm",
                    isOwnFromLead
                      ? "bg-[#d9fdd3] text-zinc-900 dark:bg-[#005c4b] dark:text-zinc-50 rounded-tr-none"
                      : "bg-white text-zinc-900 dark:bg-[#202c33] dark:text-zinc-50 rounded-tl-none",
                  )}
                >
                  {msg.body && (
                    <div className="whitespace-pre-wrap px-1.5 pt-1">
                      {msg.body}
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex justify-end text-[10px] -mt-0.5",
                      isOwnFromLead
                        ? "text-zinc-700/70 dark:text-zinc-300/70"
                        : "text-zinc-500 dark:text-zinc-400",
                    )}
                  >
                    {format(new Date(msg.createdAt), "p")}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSend}
        className="bg-white dark:bg-zinc-800 border-t px-3 py-2 flex items-center gap-2 sticky bottom-0"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Digite uma mensagem"
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm outline-none px-2 py-1.5 max-h-32"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.currentTarget.form as HTMLFormElement).requestSubmit();
            }
          }}
        />
        <Button
          type="submit"
          size="icon-sm"
          disabled={sending || !draft.trim()}
          className="shrink-0 size-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
          aria-label="Enviar"
        >
          <SendIcon className="size-4" />
        </Button>
      </form>
    </div>
  );
}

function formatDateHeader(date: string | Date) {
  const d = new Date(date);
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM/yyyy");
}
