import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { client } from "@/lib/orpc";
import { useChat } from "@ai-sdk/react";
import { eventIteratorToStream } from "@orpc/client";
import { SparklesIcon } from "lucide-react";
import { useState } from "react";

interface ComposeAssistentProps {
  conversationId: string;
  onResponse: (text: string) => void;
}

export function ComposeResponse({
  onResponse,
  conversationId,
}: ComposeAssistentProps) {
  const [content, setContent] = useState("");
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
    id: "compose-response",
    transport: {
      async sendMessages(options) {
        return eventIteratorToStream(
          await client.ia.compose.generate(
            {
              content: content,
              conversationId: conversationId,
            },
            { signal: options.abortSignal },
          ),
        );
      },
      reconnectToStream() {
        throw new Error("Unsupported");
      },
    },
  });

  const lastAssistent = messages.findLast((m) => m.role === "assistant");

  const composedText =
    lastAssistent?.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("\n\n") ?? "";

  function handleOpenChange(nextOpen: boolean) {
    console.log(nextOpen);
  }

  function handleGenerate() {
    sendMessage({ text: content });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm">
          <SparklesIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-100 p-0" align="end">
        <div className="p-4 space-y-2">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Compor resposta</h4>
          </div>

          <Input
            placeholder="Digite uma mensagem"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <Button className="ml-auto" onClick={handleGenerate}>
            Gerar
          </Button>

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
            ) : composedText ? (
              // <p>{summaryText}</p>
              <Message from="assistant">
                <MessageContent>
                  <MessageResponse parseIncompleteMarkdown={status !== "ready"}>
                    {composedText}
                  </MessageResponse>
                </MessageContent>
              </Message>
            ) : status === "submitted" || status === "streaming" ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">
                Clique em gerar para compor uma resposta
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-3 py-2 ">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onResponse(composedText);
              setOpen(false);
            }}
          >
            Enviar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
