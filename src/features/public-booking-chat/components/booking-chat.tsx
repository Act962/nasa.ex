"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { SendHorizonalIcon, BotIcon, UserIcon, CalendarCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

interface BookingChatProps {
  orgSlug: string;
  agendaSlug: string;
  agendaName: string;
  orgName: string;
  orgLogo?: string;
}

// ─────────────────────────────────────────────
// CONSENTIMENTO LGPD
// ─────────────────────────────────────────────
function ConsentBanner({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-6 text-center max-w-md mx-auto">
      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
        <CalendarCheckIcon className="size-7 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-2">Assistente de Agendamento</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Para realizar seu agendamento, precisamos coletar seu nome e telefone.
          Esses dados são usados exclusivamente para confirmar e gerenciar seu
          horário, conforme a{" "}
          <strong>Lei Geral de Proteção de Dados (LGPD)</strong>.
        </p>
      </div>
      <Button onClick={onAccept} className="w-full max-w-xs">
        Entendido, iniciar chat
      </Button>
      <p className="text-xs text-muted-foreground">
        Ao continuar, você concorda com o uso dos seus dados para fins de agendamento.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// BOLHA DE MENSAGEM
// ─────────────────────────────────────────────
function MessageBubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-2 items-end", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {isUser ? <UserIcon className="size-3.5" /> : <BotIcon className="size-3.5" />}
      </div>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words",
          isUser
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted text-foreground",
        )}
      >
        {content}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// INDICADOR DE DIGITAÇÃO
// ─────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex gap-2 items-end">
      <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
        <BotIcon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// HEADER DO CHAT
// ─────────────────────────────────────────────
function ChatHeader({ agendaName, orgName, orgLogo, isActive }: {
  agendaName: string;
  orgName: string;
  orgLogo?: string;
  isActive: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-4 border-b">
      {orgLogo ? (
        <img src={orgLogo} alt={orgName} className="w-9 h-9 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <CalendarCheckIcon className="size-4 text-primary" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate">{agendaName}</p>
        <p className="text-xs text-muted-foreground truncate">{orgName}</p>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <span className={cn("w-2 h-2 rounded-full", isActive ? "bg-green-500" : "bg-yellow-400")} />
        <span className="text-xs text-muted-foreground">{isActive ? "Online" : "Digitando..."}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────
export function BookingChat({ orgSlug, agendaSlug, agendaName, orgName, orgLogo }: BookingChatProps) {
  const [consented, setConsented] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // AI SDK v6: transport via DefaultChatTransport
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/public/booking-chat", body: { orgSlug, agendaSlug } }),
    [orgSlug, agendaSlug],
  );

  const welcomeMessages = useMemo<UIMessage[]>(
    () => [
      {
        id: "welcome",
        role: "assistant",
        content: `Olá! 👋 Sou o assistente de agendamento de **${agendaName}**.\n\nPosso te ajudar a:\n• 📅 Verificar horários disponíveis\n• ✅ Realizar um agendamento\n• ❌ Cancelar um agendamento\n\nComo posso te ajudar hoje?`,
        parts: [
          {
            type: "text" as const,
            text: `Olá! 👋 Sou o assistente de agendamento de **${agendaName}**.\n\nPosso te ajudar a:\n• 📅 Verificar horários disponíveis\n• ✅ Realizar um agendamento\n• ❌ Cancelar um agendamento\n\nComo posso te ajudar hoje?`,
          },
        ],
      },
    ],
    [agendaName],
  );

  const { messages, sendMessage, status, error } = useChat({
    transport,
    messages: welcomeMessages,
  });

  const isBusy = status === "streaming" || status === "submitted";

  // Scroll automático
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isBusy]);

  function handleSend() {
    const text = input.trim();
    if (!text || isBusy) return;
    setInput("");
    sendMessage({ text });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!consented) {
    return (
      <div className="flex flex-col h-full">
        <ChatHeader agendaName={agendaName} orgName={orgName} orgLogo={orgLogo} isActive={true} />
        <div className="flex-1 overflow-y-auto">
          <ConsentBanner onAccept={() => setConsented(true)} />
        </div>
      </div>
    );
  }

  // Filtra apenas mensagens de usuário e assistente (exclui 'system' e tool calls)
  const visibleMessages = messages.filter((m) => m.role !== "system");

  return (
    <div className="flex flex-col h-full">
      <ChatHeader agendaName={agendaName} orgName={orgName} orgLogo={orgLogo} isActive={!isBusy} />

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {visibleMessages.map((message) => {
          const textContent = message.parts
            ?.filter((p) => p.type === "text")
            .map((p) => (p as { type: "text"; text: string }).text)
            .join("") ?? "";

          if (!textContent) return null;

          return (
            <MessageBubble
              key={message.id}
              role={message.role as "user" | "assistant"}
              content={textContent}
            />
          );
        })}

        {isBusy && <TypingIndicator />}

        {error && (
          <p className="text-xs text-destructive text-center">
            Ocorreu um erro. Por favor, tente novamente.
          </p>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-3 flex gap-2 items-end">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua mensagem..."
          className="resize-none min-h-[40px] max-h-[120px] text-sm"
          rows={1}
          disabled={isBusy}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={isBusy || !input.trim()}
          className="shrink-0 h-10 w-10"
        >
          {isBusy ? <Spinner className="size-4" /> : <SendHorizonalIcon className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
