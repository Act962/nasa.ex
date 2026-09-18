"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useSendTrafegoMessage,
  useTrafegoMessages,
} from "@/features/trafego/hooks/use-trafego-support";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 20_000;

export function SupportThread({ orderId }: { orderId: string }) {
  const [draft, setDraft] = useState("");
  const { data: messages, isLoading } = useTrafegoMessages(orderId, {
    refetchInterval: POLL_INTERVAL_MS,
  });
  const sendMessage = useSendTrafegoMessage(orderId);

  function handleSend() {
    const body = draft.trim();
    if (!body) return;

    sendMessage.mutate(
      { orderId, body },
      {
        onSuccess: () => setDraft(""),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div>
        <h3 className="text-sm font-semibold">Falar com a equipe</h3>
        <p className="text-xs text-muted-foreground">
          Dúvidas, pedidos de ajuste ou qualquer coisa sobre esta campanha.
        </p>
      </div>

      <div className="mt-4 flex-1 space-y-3">
        {isLoading && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Carregando conversa…
          </div>
        )}

        {!isLoading && (!messages || messages.length === 0) && (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhuma mensagem ainda. Escreva abaixo — nossa equipe responde por aqui.
          </div>
        )}

        {messages?.map((message) => {
          const isTeam = message.authorRole === "NASA";
          return (
            <div
              key={message.id}
              className={cn("flex", isTeam ? "justify-start" : "justify-end")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5",
                  isTeam ? "bg-muted" : "bg-primary text-primary-foreground",
                )}
              >
                {isTeam && (
                  <p className="text-xs font-medium opacity-70">
                    {message.author.name ?? "Equipe NASA"}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-sm">{message.body}</p>
                <time
                  className={cn(
                    "mt-1 block text-[10px]",
                    isTeam ? "text-muted-foreground" : "text-primary-foreground/70",
                  )}
                >
                  {new Date(message.createdAt).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t pt-4">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              handleSend();
            }
          }}
          placeholder="Escreva sua mensagem…"
          rows={3}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            ⌘/Ctrl + Enter para enviar
          </span>
          <Button
            type="button"
            size="sm"
            onClick={handleSend}
            disabled={!draft.trim() || sendMessage.isPending}
          >
            {sendMessage.isPending ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Send className="mr-1.5 size-4" />
            )}
            Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}
