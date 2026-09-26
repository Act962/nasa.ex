"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useCatalogOrderMessages,
  useSendCatalogOrderMessage,
} from "../../hooks/use-catalog-order-portal";

export function OrderChat({ token, storeName }: { token: string; storeName: string }) {
  const messagesQuery = useCatalogOrderMessages(token);
  const sendMessage = useSendCatalogOrderMessage(token);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const messages = messagesQuery.data?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    sendMessage.mutate(
      { token, body },
      {
        onSuccess: () => setDraft(""),
        onError: () => toast.error("Não foi possível enviar. Tente de novo."),
      },
    );
  };

  return (
    <div className="flex h-[520px] flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messagesQuery.isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {messages.map((message) => {
          // No portal a perspectiva é do cliente: fromMe=true é a loja falando.
          const isFromStore = message.fromMe;
          const text = message.body ?? message.mediaCaption ?? (message.mediaType ? `[${message.mediaType}]` : "");
          return (
            <div key={message.id} className={cn("flex", isFromStore ? "justify-start" : "justify-end")}>
              <div
                className={cn(
                  "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm",
                  isFromStore ? "bg-muted" : "bg-primary text-primary-foreground",
                )}
              >
                {isFromStore && (
                  <p className="mb-0.5 text-xs font-semibold opacity-70">{message.senderName ?? storeName}</p>
                )}
                {text}
                <p className="mt-1 text-right text-[10px] opacity-60">
                  {format(new Date(message.createdAt), "HH:mm")}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t p-3">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) handleSubmit(event);
          }}
          placeholder="Escreva sua mensagem…"
          rows={1}
          className="min-h-10 resize-none"
        />
        <Button type="submit" size="icon" disabled={sendMessage.isPending || !draft.trim()}>
          {sendMessage.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
  );
}
