"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SparklesIcon,
  SendIcon,
  LightbulbIcon,
  ZapIcon,
  WorkflowIcon,
  CheckCircle2Icon,
  XCircleIcon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Message,
  MessageContent,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import { Spinner } from "@/components/ui/spinner";
import { ChatAvatar } from "@/features/actions/components/ai-button/chat-avatar";
import { useTrackingAi } from "@/features/trackings/hooks/use-tracking-ai";
import { SUGGESTED_PROMPTS } from "./constants";
import { MessageTextPart } from "./message-text-part";
import { AiLeadButtonProps } from "./types";

const AUTOMATION_TOOL_LABELS: Record<string, string> = {
  // Legado (caminho 3 — addNode + connectNodes manual)
  createWorkflow: "Criar automação (vazia)",
  updateWorkflow: "Atualizar automação",
  addNode: "Adicionar nó",
  connectNodes: "Conectar nós",
  executeWorkflow: "Executar automação",
  getWorkflow: "Verificar automação",
  listWorkflows: "Listar automações",
  // IA generativa novas (caminho 1 + 2)
  generate_workflow_from_intent: "🤖 Gerando workflow inteiro com IA",
  apply_workflow_preset: "📦 Aplicando preset",
  list_workflow_presets: "📋 Listando presets disponíveis",
};

const AUTOMATION_TOOLS = new Set(Object.keys(AUTOMATION_TOOL_LABELS));

export function AiLeadButton({ trackingId, children }: AiLeadButtonProps) {
  const [prompt, setPrompt] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading, sendMessage, status, error, clearError, stop } =
    useTrackingAi(trackingId);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, status, scrollToBottom]);

  const handleGenerate = () => {
    if (!prompt.trim() || isLoading) return;
    const currentPrompt = prompt;
    setPrompt("");
    sendMessage(currentPrompt);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>

      <SheetContent
        side="right"
        className="sm:max-w-md border-l border-zinc-800 px-0 flex flex-col h-full gap-0 bg-zinc-950"
      >
        <SheetHeader className="space-y-4 mb-6 px-4 pt-4 border-b border-zinc-900 pb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <SparklesIcon className="size-5 text-purple-500" />
            </div>
            <SheetTitle className="text-2xl font-bold tracking-tight text-zinc-100">
              Gestão de Leads
            </SheetTitle>
          </div>
          <SheetDescription className="text-sm text-zinc-400">
            Descreva o que precisa e o ASTRO gerenciará seus leads no funil.
          </SheetDescription>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 px-4 h-full overflow-y-auto">
          <div className="flex flex-col gap-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-6 pt-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-widest ml-1">
                    <LightbulbIcon className="size-3.5" />
                    Sugestões de início
                  </div>
                  <div className="grid gap-2">
                    {SUGGESTED_PROMPTS.map((item, idx) => (
                      <Card
                        key={idx}
                        className="cursor-pointer bg-zinc-900/40 hover:bg-zinc-900 transition-all border-zinc-800 hover:border-purple-500/30 group"
                        onClick={() => setPrompt(item.text)}
                      >
                        <CardContent className="p-3 flex items-start gap-3">
                          <div
                            className={cn(
                              "p-1.5 rounded-md bg-zinc-950 border border-zinc-800 shadow-sm transition-colors",
                              item.color,
                            )}
                          >
                            <item.icon className="size-3.5" />
                          </div>
                          <p className="text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors leading-relaxed">
                            {item.text}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((message, i) => {
              const isLastMessage = i === messages.length - 1;
              const isStreamingThisMessage =
                status === "streaming" && isLastMessage;

              return (
                <Message key={message.id || i} from={message.role}>
                  <div
                    className={cn(
                      "flex items-start gap-3",
                      message.role === "user" ? "flex-row-reverse" : "flex-row",
                    )}
                  >
                    <ChatAvatar role={message.role} />

                    <MessageContent
                      className={cn(
                        "px-4 py-2 rounded-2xl max-w-[90%] shadow-sm",
                        message.role === "user"
                          ? "bg-purple-600 text-white rounded-tr-none"
                          : "bg-zinc-900 text-zinc-200 border border-zinc-800 rounded-tl-none",
                      )}
                    >
                      {message.parts.map((part, partIdx) => {
                        if (part.type === "text") {
                          return (
                            <MessageTextPart
                              key={partIdx}
                              text={part.text}
                              isStreaming={isStreamingThisMessage}
                            />
                          );
                        }

                        if (part.type.startsWith("tool-")) {
                          const toolPart = part as {
                            type: string;
                            state: string;
                            output?: Record<string, unknown>;
                          };
                          const toolName = toolPart.type.replace("tool-", "");
                          const isAutomation = AUTOMATION_TOOLS.has(toolName);
                          const label =
                            AUTOMATION_TOOL_LABELS[toolName] ?? toolName;
                          const isComplete =
                            toolPart.state === "output-available";
                          const isSuccess =
                            isComplete && !!toolPart.output?.success;

                          return (
                            <MessageActions key={partIdx}>
                              <MessageAction
                                tooltip={label}
                                className={cn(
                                  "flex items-center gap-2 text-[10px] font-mono italic my-1 h-auto py-0.5 px-1 w-full justify-start",
                                  isComplete
                                    ? isSuccess
                                      ? "text-emerald-500 opacity-80"
                                      : "text-red-400 opacity-80"
                                    : "text-zinc-500 opacity-70",
                                )}
                              >
                                {isComplete ? (
                                  isSuccess ? (
                                    <CheckCircle2Icon className="size-3 text-emerald-500" />
                                  ) : (
                                    <XCircleIcon className="size-3 text-red-400" />
                                  )
                                ) : isAutomation ? (
                                  <WorkflowIcon className="size-3 text-blue-400" />
                                ) : (
                                  <ZapIcon className="size-3 text-purple-500" />
                                )}
                                <span>
                                  {isComplete
                                    ? isSuccess
                                      ? label
                                      : `Falhou: ${label}`
                                    : `${label}...`}
                                </span>
                              </MessageAction>
                            </MessageActions>
                          );
                        }

                        return null;
                      })}
                    </MessageContent>
                  </div>
                </Message>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-zinc-900 bg-zinc-950/80 backdrop-blur-md">
          {error && (
            <div className="py-2">
              <span className="text-sm text-muted-foreground">
                Algo deu errado na sua solicitação.{" "}
                <span
                  className="underline text-blue-400 cursor-pointer"
                  onClick={() => {
                    clearError();
                    stop();
                  }}
                >
                  Concluir
                </span>
              </span>
            </div>
          )}
          <InputGroup className="border-zinc-800 rounded-2xl flex-col h-auto">
            <div className="flex w-full items-end">
              <InputGroupTextarea
                placeholder="Pergunte ao ASTRO sobre seus leads..."
                className="min-h-11 max-h-40 text-sm text-zinc-100 placeholder:text-zinc-600"
                value={prompt}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <InputGroupAddon align="inline-end" className="pb-2 pr-2">
                {status === "submitted" || status === "streaming" ? (
                  <InputGroupButton
                    size="icon-sm"
                    className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white"
                    onClick={stop}
                  >
                    <Spinner className="size-4" />
                  </InputGroupButton>
                ) : (
                  <InputGroupButton
                    disabled={!prompt.trim()}
                    size="icon-sm"
                    className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-20 disabled:bg-zinc-800"
                    onClick={handleGenerate}
                  >
                    <SendIcon className="size-4" />
                  </InputGroupButton>
                )}
              </InputGroupAddon>
            </div>
          </InputGroup>
        </div>
      </SheetContent>
    </Sheet>
  );
}
