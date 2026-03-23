"use client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { authClient } from "@/lib/auth-client";
import { SendIcon, Bot, User, Loader2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { cn } from "@/lib/utils";

interface ChatTestAiModalProps {
  trackingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const ChatTestAiModal = ({
  trackingId,
  open,
  onOpenChange,
}: ChatTestAiModalProps) => {
  const [inputMessage, setInputMessage] = useState("");
  const { data: session } = authClient.useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMsg = inputMessage;
    setInputMessage(""); // Limpa o input imediatamente
    setMessages([{ role: "user", content: userMsg }]); // Reseta a lista para apenas o novo user message
    setIsLoading(true);

    try {
      const response = await fetch("https://n8n.nasaex.com/webhook/chat-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trackingId,
          userId: session?.user.id,
          message: userMsg,
        }),
      });

      const data = await response.json();

      if (data && data.output) {
        setMessages([
          { role: "user", content: userMsg },
          { role: "assistant", content: data.output },
        ]);
      } else {
        setMessages([
          { role: "user", content: userMsg },
          {
            role: "assistant",
            content: "Não foi possível obter uma resposta da IA.",
          },
        ]);
      }
    } catch (error) {
      console.error("Error fetching AI response:", error);
      setMessages([
        { role: "user", content: userMsg },
        { role: "assistant", content: "Erro de conexão. Tente novamente." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl h-[600px] flex flex-col p-6 rounded-3xl">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            Testar IA
          </DialogTitle>
          <DialogDescription className="text-sm">
            Teste como a IA responde em tempo real. Cada nova pergunta reseta o
            histórico.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-8 space-y-6 px-2">
          {messages.length === 0 && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40 space-y-4 animate-in fade-in duration-500">
              <div className="p-4 rounded-full bg-muted/30">
                <Bot className="w-10 h-10" />
              </div>
              <p className="font-medium">O que você gostaria de perguntar?</p>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "flex w-full gap-4 shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500",
                message.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {message.role === "assistant" && (
                <div className="w-9 h-9 rounded-2xl bg-secondary flex items-center justify-center shrink-0 shadow-sm">
                  <Bot className="w-5 h-5 text-secondary-foreground" />
                </div>
              )}

              <div
                className={cn(
                  "max-w-[85%] px-5 py-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-none font-medium"
                    : "bg-muted text-muted-foreground rounded-tl-none border border-border/50",
                )}
              >
                {message.content}
              </div>

              {message.role === "user" && (
                <div className="w-9 h-9 rounded-2xl bg-muted flex items-center justify-center shrink-0 border border-border/50">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start gap-4 animate-pulse">
              <div className="w-9 h-9 rounded-2xl bg-secondary flex items-center justify-center shadow-sm">
                <Bot className="w-5 h-5 text-secondary-foreground" />
              </div>
              <div className="bg-muted text-muted-foreground px-5 py-4 rounded-3xl rounded-tl-none border border-border/50 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 border-t px-2">
          <form onSubmit={handleMessage} className="relative">
            <InputGroup className="bg-muted/30 border border-border/50 rounded-2xl transition-all duration-300 focus-within:ring-2 ring-primary/10 focus-within:border-primary/30 h-16 shadow-inner">
              <InputGroupInput
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={
                  isLoading
                    ? "IA está processando..."
                    : "Escreva sua dúvida aqui..."
                }
                disabled={isLoading}
                className="bg-transparent border-0 focus-visible:ring-0 text-sm pl-6"
              />
              <InputGroupAddon align="inline-end" className="pr-3">
                <Button
                  type="submit"
                  size="icon"
                  disabled={!inputMessage.trim() || isLoading}
                  className={cn(
                    "rounded-xl w-10 h-10 transition-all duration-300",
                    !inputMessage.trim()
                      ? "opacity-20 scale-90"
                      : "hover:scale-105 active:scale-95 shadow-lg shadow-primary/20",
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <SendIcon className="w-4 h-4" />
                  )}
                </Button>
              </InputGroupAddon>
            </InputGroup>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
