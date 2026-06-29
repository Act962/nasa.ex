"use client";

/**
 * StationChatPanel — drawer lateral direito com o Chat Geral da Station.
 *
 * Visual emparelhado com `BubbleChatPanel` (mesmo width, header e estilo
 * dark/glass) pra UX consistente. Conteúdo:
 *   - Header: "Chat geral" + count de membros (vem do BubbleAppsPanel/peers)
 *   - Body: lista de mensagens cronológica (mais recente embaixo), agrupada
 *     por sender em sequência
 *   - Footer: Textarea + Send (Enter envia, Shift+Enter quebra linha)
 *
 * Hook: `useStationChat({ stationId, isOpen })` cuida de fetch + Pusher
 * subscribe + send. Drawer aberto reseta unreadCount automaticamente.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useStationChat,
  type StationChatMessage,
} from "../../hooks/use-station-chat";

interface Props {
  stationId: string;
  open: boolean;
  onClose: () => void;
}

export function StationChatPanel({ stationId, open, onClose }: Props) {
  const { data: session } = authClient.useSession();
  const myUserId = session?.user?.id;
  const { messages, isLoading, sendMessage, isSending } = useStationChat({
    stationId,
    isOpen: open,
  });
  const [draft, setDraft] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  // Inverter ordem pra cronológica (mais recente embaixo). O backend devolve DESC.
  const orderedMessages = useMemo(
    () => [...messages].reverse(),
    [messages],
  );

  // Auto-scroll pro fim quando drawer abre OU chega mensagem nova.
  useEffect(() => {
    if (open && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [open, orderedMessages.length]);

  function handleSend() {
    if (!draft.trim() || isSending) return;
    sendMessage(draft);
    setDraft("");
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity",
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        )}
      />

      {/* Drawer */}
      <aside
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-[400px] max-w-[95vw]",
          "bg-slate-950 border-l border-white/10 shadow-2xl",
          "flex flex-col transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 flex-shrink-0">
          <MessageCircle className="h-4 w-4 text-indigo-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Chat geral</p>
            <p className="text-[10px] text-slate-400">
              Todos no World veem essas mensagens
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div
          ref={bodyRef}
          className="flex-1 overflow-y-auto px-3 py-3 space-y-2"
        >
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-slate-400 text-xs gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando mensagens…
            </div>
          )}

          {!isLoading && orderedMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <MessageCircle className="h-8 w-8 text-slate-600 mb-2" />
              <p className="text-xs text-slate-400">
                Nenhuma mensagem ainda. Seja o primeiro a quebrar o gelo!
              </p>
            </div>
          )}

          {orderedMessages.map((m, idx) => {
            const prev = orderedMessages[idx - 1];
            const sameSender = prev?.senderId === m.senderId;
            const isMine = m.senderId === myUserId;
            return (
              <MessageRow
                key={m.id}
                msg={m}
                showHeader={!sameSender}
                isMine={isMine}
              />
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 p-2 flex flex-col gap-1 flex-shrink-0">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder="Mensagem pra todos…"
            rows={2}
            className="resize-none text-xs bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-indigo-500 max-h-[120px]"
          />
          <div className="flex items-center justify-end gap-2">
            <span className="text-[9px] text-slate-500 mr-auto">
              Enter envia • Shift+Enter quebra linha
            </span>
            <Button
              onClick={handleSend}
              disabled={!draft.trim() || isSending}
              size="sm"
              className="h-7 px-2.5 gap-1 text-xs bg-indigo-600 hover:bg-indigo-500"
            >
              {isSending ? (
                <Spinner className="h-3 w-3" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              Enviar
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

function MessageRow({
  msg,
  showHeader,
  isMine,
}: {
  msg: StationChatMessage;
  showHeader: boolean;
  isMine: boolean;
}) {
  return (
    <div className={cn("flex flex-col", isMine ? "items-end" : "items-start")}>
      {showHeader && (
        <div className="flex items-center gap-1.5 mb-0.5 px-1">
          {msg.senderImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={msg.senderImage}
              alt={msg.senderName}
              className="w-4 h-4 rounded-full object-cover"
            />
          ) : (
            <span className="w-4 h-4 rounded-full bg-indigo-500/30 text-[8px] font-bold text-indigo-200 flex items-center justify-center">
              {msg.senderName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="text-[10px] font-semibold text-slate-300">
            {isMine ? "Você" : msg.senderName}
          </span>
          <span className="text-[9px] text-slate-500">
            {new Date(msg.createdAt).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] px-2.5 py-1.5 rounded-lg text-xs break-words whitespace-pre-wrap",
          isMine
            ? "bg-indigo-600/80 text-white rounded-tr-sm"
            : "bg-white/8 text-slate-100 rounded-tl-sm",
        )}
      >
        {msg.body}
      </div>
    </div>
  );
}
