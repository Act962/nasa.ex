"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Send, Lightbulb, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  useSuspenseWokspaces,
  useSuspenseColumnsByWorkspace,
} from "@/features/workspace/hooks/use-workspace";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { useQueryState } from "nuqs";

import {
  Message,
  MessageContent,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";

import { useWorkspaceAi } from "../../hooks/use-create-action-with-ai";
import { CreateActionWithAiProps } from "./types";
import { SUGGESTED_PROMPTS } from "./constants";
import { ChatAvatar } from "./chat-avatar";
import { MessageTextPart } from "./message-text-part";
import { ContextSelector } from "./context-selector";
import { Spinner } from "@/components/ui/spinner";
import { useQueryClient } from "@tanstack/react-query";

export function CreateActionWithAi({
  workspaceId: initialWorkspaceId,
}: CreateActionWithAiProps) {
  const [prompt, setPrompt] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, setActionId] = useQueryState("actionId", { shallow: true });

  const { data: workspacesData } = useSuspenseWokspaces();
  const workspaces = workspacesData.workspaces;

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(
    initialWorkspaceId || workspaces[0]?.id,
  );

  const { data: columnsData } =
    useSuspenseColumnsByWorkspace(selectedWorkspaceId);
  const columns = columnsData.columns;

  const [selectedColumnId, setSelectedColumnId] = useState(columns[0]?.id);

  useEffect(() => {
    if (initialWorkspaceId) setSelectedWorkspaceId(initialWorkspaceId);
  }, [initialWorkspaceId]);

  useEffect(() => {
    if (columns.length > 0 && !columns.some((c) => c.id === selectedColumnId)) {
      setSelectedColumnId(columns[0].id);
    }
  }, [columns, selectedColumnId]);

  const { messages, isLoading, sendMessage, status, error, clearError, stop } =
    useWorkspaceAi(selectedWorkspaceId, selectedColumnId);

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

  // Auto-scroll when messages change or while streaming
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, status, scrollToBottom]);

  const selectedWorkspace = workspaces.find(
    (w) => w.id === selectedWorkspaceId,
  );
  const selectedColumn = columns.find((c) => c.id === selectedColumnId);

  const handleGenerate = async () => {
    if (!prompt.trim() || isLoading) return;
    const currentPrompt = prompt;
    setPrompt("");
    await sendMessage(currentPrompt, {
      workspaceId: selectedWorkspaceId,
      columnId: selectedColumnId,
    });
  };

  const handleSelectWorkspace = (id: string) => setSelectedWorkspaceId(id);

  const handleSelectColumn = (workspaceId: string, columnId: string) => {
    setSelectedWorkspaceId(workspaceId);
    setSelectedColumnId(columnId);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="flex-1 lg:w-auto" size="sm">
          <Sparkles className="size-4 mr-2 text-purple-500 group-hover:animate-pulse" />
          <span className="bg-linear-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent font-semibold">
            Criar com IA
          </span>
          <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-purple-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="sm:max-w-md border-l border-zinc-800 px-0 flex flex-col h-full gap-0 bg-zinc-950"
      >
        <SheetHeader className="space-y-4 mb-6 px-4 pt-4 border-b border-zinc-900 pb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Sparkles className="size-5 text-purple-500" />
            </div>
            <SheetTitle className="text-2xl font-bold tracking-tight text-zinc-100">
              Gerador de Ações
            </SheetTitle>
          </div>
          <SheetDescription className="text-sm text-zinc-400">
            Descreva suas tarefas e o ASTRO as organizará para você nos fluxos
            corretos em segundos.
          </SheetDescription>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 px-4 h-full overflow-y-auto">
          <div className="flex flex-col gap-4 py-4">
            {/* Estado vazio: sugestões */}
            {messages.length === 0 && (
              <div className="space-y-6 pt-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-widest ml-1">
                    <Lightbulb className="size-3.5" />
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

            {/* ✅ Lista de mensagens usando os componentes semânticos */}
            {messages.map((message, i) => {
              const isLastMessage = i === messages.length - 1;
              const isStreamingThisMessage =
                status === "streaming" && isLastMessage;

              return (
                // ✅ Message define role e alinhamento via CSS semântico
                <Message key={message.id || i} from={message.role}>
                  <div
                    className={cn(
                      "flex items-start gap-3",
                      message.role === "user" ? "flex-row-reverse" : "flex-row",
                    )}
                  >
                    <ChatAvatar role={message.role} />

                    {/* ✅ MessageContent encapsula o balão de mensagem */}
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
                              onViewAction={setActionId}
                            />
                          );
                        }

                        if (part.type.startsWith("tool-")) {
                          // ✅ MessageActions para actions de tool use
                          return (
                            <MessageActions key={partIdx}>
                              <MessageAction
                                tooltip={`Processando: ${part.type.replace("tool-", "")}`}
                                className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono italic my-1 opacity-70 h-auto py-0.5 px-1 w-full justify-start"
                              >
                                <Zap className="size-3 text-purple-500" />
                                <span>
                                  Processando: {part.type.replace("tool-", "")}
                                  ...
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

        {/* Input */}
        <div className="p-4 border-t border-zinc-900 bg-zinc-950/80 backdrop-blur-md">
          {error && (
            <div className={"py-2"}>
              {" "}
              <span className="text-sm text-muted-foreground">
                Algo deu errado na sua solicitação. Por favor, relate ao suporte
                ou tente novamente{" "}
                <span
                  className="underline text-blue-400 cursor-pointer"
                  onClick={() => [clearError(), stop()]}
                >
                  Concluir
                </span>
              </span>{" "}
            </div>
          )}
          <InputGroup className="border-zinc-800 rounded-2xl flex-col h-auto">
            <InputGroupAddon align="block-start" className="border-zinc-800/50">
              <ContextSelector
                workspaces={workspaces}
                columns={columns}
                selectedWorkspaceId={selectedWorkspaceId}
                selectedColumnId={selectedColumnId}
                selectedWorkspaceName={selectedWorkspace?.name}
                selectedColumnName={selectedColumn?.name}
                onSelectWorkspace={handleSelectWorkspace}
                onSelectColumn={handleSelectColumn}
              />
            </InputGroupAddon>

            <div className="flex w-full items-end">
              <InputGroupTextarea
                placeholder="Pergunte ao ASTRO..."
                className="min-h-[44px] max-h-[160px] text-sm text-zinc-100 placeholder:text-zinc-600"
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
                    className={cn(
                      "rounded-xl transition-all shadow-lg shrink-0",
                      "bg-purple-600 hover:bg-purple-500 text-white",
                      "disabled:opacity-20 disabled:scale-95 disabled:bg-zinc-800",
                    )}
                    onClick={stop}
                  >
                    <Spinner className="size-4" />
                  </InputGroupButton>
                ) : (
                  <InputGroupButton
                    disabled={!prompt.trim()}
                    size="icon-sm"
                    className={cn(
                      "rounded-xl transition-all shadow-lg shrink-0",
                      "bg-purple-600 hover:bg-purple-500 text-white",
                      "disabled:opacity-20 disabled:scale-95 disabled:bg-zinc-800",
                    )}
                    onClick={handleGenerate}
                  >
                    <Send className="size-4" />
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
