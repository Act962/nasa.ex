"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SparklesIcon } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { eventIteratorToStream } from "@orpc/client";
import { client } from "@/lib/orpc";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import dayjs from "dayjs";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";

interface Props {
  conversationId: string;
}

export function SummerizeConversation({ conversationId }: Props) {
  const [open, setOpen] = useState(false);
  const {
    messages,
    status,
    error,
    sendMessage,
    setMessages,
    stop,
    clearError,
  } = useChat({
    id: `conversation-summary:${conversationId}`,
    transport: {
      async sendMessages(options) {
        return eventIteratorToStream(
          await client.ia.conversation.summary.generate(
            {
              conversationId: conversationId,
              date: dayjs().startOf("day").toISOString(),
            },
            { signal: options.abortSignal },
          ),
        );
      },
      reconnectToStream() {
        throw new Error("Method not implemented.");
      },
    },
  });

  const lastAssistent = messages.findLast((m) => m.role === "assistant");

  const summaryText =
    lastAssistent?.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("\n\n") ?? "";

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      const hasAssistantMessage = messages.some((m) => m.role === "assistant");

      if (status !== "ready" || hasAssistantMessage) {
        return;
      }

      sendMessage({ text: "Resuma a conversa de hoje" });
    } else {
      stop();
      clearError();

      setMessages([]);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button size="sm">
          <SparklesIcon className="size-4" />
          Resumo
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-100 p-0" align="end">
        <div className="p-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Resumo da conversa</h2>
            <p className="text-xs text-muted-foreground">
              Aqui você pode ver um resumo da conversa de hoje.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => sendMessage({ text: "Resuma a conversa de hoje" })}
            >
              {" "}
              <SparklesIcon className="size-4" />
              Gerar resumo
            </Button>
          </div>

          {status === "streaming" && (
            <Button type="button" onClick={() => stop()} variant="outline">
              Parar
            </Button>
          )}

          <div className="max-h-80 overflow-y-auto">
            {error ? (
              <div>
                <p className="text-red-500">Erro ao gerar resumo</p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    clearError();
                    setMessages([]);
                    sendMessage({ text: "Resuma a conversa de hoje" });
                  }}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : summaryText ? (
              // <p>{summaryText}</p>
              <Message from="assistant">
                <MessageContent>
                  <MessageResponse parseIncompleteMarkdown={status !== "ready"}>
                    {summaryText}
                  </MessageResponse>
                </MessageContent>
              </Message>
            ) : status === "submitted" || status === "streaming" ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// pnpm dlx shadcn@latest add @ai-elements/response
