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
          <Sparkles className="size-4 mr-2 text-info group-hover:animate-pulse" />
          <span className="bg-linear-to-r from-info to-info bg-clip-text text-transparent font-semibold">
            Criar com IA
          </span>
          <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-info to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="sm:max-w-md border-l border-line px-0 flex flex-col h-full gap-0 bg-background"
      >
        <SheetHeader className="space-y-4 mb-6 px-4 pt-4 pb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-info/10">
              <Sparkles className="size-5 text-info" />
            </div>
            <SheetTitle className="text-2xl font-bold tracking-tight text-foreground">
              Gerador de Ações
            </SheetTitle>
          </div>
          <SheetDescription className="text-sm text-muted-foreground">
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
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest ml-1">
                    <Lightbulb className="size-3.5" />
                    Sugestões de início
                  </div>
                  <div className="grid gap-2">
                    {SUGGESTED_PROMPTS.map((item, idx) => (
                      <Card
                        key={idx}
                        className="cursor-pointer bg-card/40 hover:bg-card transition-all border-line hover:border-info/30 group"
                        onClick={() => setPrompt(item.text)}
                      >
                        <CardContent className="p-3 flex items-start gap-3">
                          <div
                            className={cn(
                              "p-1.5 rounded-md bg-background border border-line shadow-sm transition-colors",
                              item.color,
                            )}
                          >
                            <item.icon className="size-3.5" />
                          </div>
                          <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors leading-relaxed">
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
                          ? "bg-info text-white rounded-tr-none"
                          : "bg-card text-foreground border border-line rounded-tl-none",
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
                                className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono italic my-1 opacity-70 h-auto py-0.5 px-1 w-full justify-start"
                              >
                                <Zap className="size-3 text-info" />
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
        <div className="p-4 border-t border-line bg-background/80 backdrop-blur-md">
          {error && (
            <div className={"py-2"}>
              {" "}
              <span className="text-sm text-muted-foreground">
                Algo deu errado na sua solicitação. Por favor, relate ao suporte
                ou tente novamente{" "}
                <span
                  className="underline text-info cursor-pointer"
                  onClick={() => [clearError(), stop()]}
                >
                  Concluir
                </span>
              </span>{" "}
            </div>
          )}
          <InputGroup className="border-line rounded-2xl flex-col h-auto">
            <InputGroupAddon align="block-start" className="border-line/50">
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
                className="min-h-[44px] max-h-[160px] text-sm text-foreground placeholder:text-muted-foreground"
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
                      "bg-info hover:bg-info text-white",
                      "disabled:opacity-20 disabled:scale-95 disabled:bg-card",
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
                      "bg-info hover:bg-info text-white",
                      "disabled:opacity-20 disabled:scale-95 disabled:bg-card",
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
