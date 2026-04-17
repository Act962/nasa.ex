"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { useSpacePointCtx } from "@/features/space-point/components/space-point-provider";

import { ChatMessage, DropdownType, ModelType } from "../types";
import { buildThinkingSteps, loadRecentCommands, saveRecentCommand } from "../utils";
import { CommandInputProps } from "./command-input";
import { StarField } from "./star-field";
import { WelcomeScreen } from "./welcome-screen";
import { UserBubble } from "./user-bubble";
import { ThinkingDisplay } from "./thinking-display";
import { ResponseCard } from "./response-card";
import { CommandInput } from "./command-input";

export function NasaCommandCenter() {
  const [command, setCommand] = useState("");
  const [dropdown, setDropdown] = useState<DropdownType>(null);
  const [dropdownSearch, setDropdownSearch] = useState("");
  const [model, setModel] = useState<ModelType>("astro");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { earn } = useSpacePointCtx();

  useEffect(() => {
    setRecentCommands(loadRecentCommands());
  }, []);

  const executeCommand = useMutation(
    orpc.nasaCommand.execute.mutationOptions(),
  );

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submitCommand = useCallback(
    async (userText: string) => {
      if (!userText.trim() || loading) return;
      setLoading(true);
      setCommand("");
      setDropdown(null);
      setRecentCommands(saveRecentCommand(userText));

      const thinkingSteps = buildThinkingSteps(userText);
      const msgId = Math.random().toString(36).slice(2);

      setMessages((prev) => [
        ...prev,
        { id: msgId + "-user", role: "user", command: userText },
        {
          id: msgId + "-think",
          role: "assistant",
          isThinking: true,
          thinking: thinkingSteps,
          originalCommand: userText,
        },
      ]);

      try {
        const res = await executeCommand.mutateAsync({
          command: userText,
          model,
        });
        earn("ai_command", "Comando IA executado 🤖");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId + "-think"
              ? {
                  ...m,
                  isThinking: false,
                  result: {
                    type: res.type,
                    title: res.title,
                    description: res.description,
                    url: res.url ?? "/home",
                    appName: res.appName,
                    resultLinks: res.resultLinks,
                    missingFields: res.missingFields,
                    partialContext: res.partialContext,
                    content: res.content,
                    starsSpent: res.starsSpent,
                    confirmOptions: res.confirmOptions,
                  },
                }
              : m,
          ),
        );
      } catch (err: unknown) {
        const message =
          (err as { message?: string })?.message ??
          "Erro ao processar o comando.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId + "-think"
              ? {
                  ...m,
                  isThinking: false,
                  result: {
                    type: "error" as const,
                    title: "Erro",
                    description: message,
                    url: "/home",
                    appName: "NASA",
                  },
                }
              : m,
          ),
        );
        toast.error(message);
      } finally {
        setLoading(false);
        // Atualiza saldo de stars imediatamente após o comando
        queryClient.invalidateQueries({
          queryKey: orpc.stars.getBalance.queryOptions().queryKey,
        });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [model, queryClient, executeCommand, loading, earn],
  );

  const handleSubmit = async () => {
    if (!command.trim() || loading) return;
    await submitCommand(command.trim());
  };

  // Chamado pelo hook de voz quando o transcript chega → envia direto
  const handleVoiceTranscript = useCallback(
    (text: string) => {
      if (!text.trim() || loading) return;
      submitCommand(text.trim());
    },
    [loading, submitCommand],
  );

  // Re-submit with extra /"key"="value" pairs appended to the original command
  const handleContinue = (originalCommand: string) => (extra: string) => {
    // Rebuild: original command + partialContext pairs (already parsed server-side) + new fields
    submitCommand(`${originalCommand} ${extra}`);
  };

  // Handle confirmation option button clicks
  // NOTE: originalCommand already contains all /"key"="value" pairs from the previous step.
  // We only append the NEW decision key — never re-append ctxPairs to avoid duplicates.
  const handleConfirm =
    (originalCommand: string, _partialContext: Record<string, unknown>) =>
    (key: string) => {
      if (key.startsWith("lead_")) {
        const leadId = key.replace("lead_", "");
        submitCommand(
          `${originalCommand} /"lead_id"="${leadId}" /"lead_confirmed"="true"`,
        );
      } else if (key === "create_new_lead") {
        submitCommand(`${originalCommand} /"create_new_lead"="true"`);
      } else if (key.startsWith("status_")) {
        const statusId = key.replace("status_", "");
        submitCommand(`${originalCommand} /"status_id"="${statusId}"`);
      } else {
        submitCommand(`${originalCommand} /"${key}"="true"`);
      }
    };

  const fillExample = (example: string) => {
    setCommand(example);
  };

  const hasMessages = messages.length > 0;

  const commandInputProps: CommandInputProps = {
    command,
    setCommand,
    loading,
    onSubmit: handleSubmit,
    onVoiceTranscript: handleVoiceTranscript,
    model,
    setModel,
    dropdown,
    setDropdown,
    dropdownSearch,
    setDropdownSearch,
  };

  return (
    <div
      className="h-full flex flex-col bg-[#050510] relative overflow-hidden"
      style={{ cursor: "url('/cursors/rocket.svg') 6 4, auto" }}
    >
      <StarField />
      {/* ── Top bar: always visible ── */}
      <HeaderTracking title="Home" />

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto relative z-10">
        {!hasMessages ? (
          <WelcomeScreen
            onSelect={fillExample}
            commandInputProps={commandInputProps}
            recentCommands={recentCommands}
            onClearRecent={() => {
              localStorage.removeItem("nasa-explorer:recent-commands");
              setRecentCommands([]);
            }}
          />
        ) : (
          <div className="max-w-3xl mx-auto px-3 sm:px-4 pt-4 pb-4 space-y-2">
            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.role === "user" && msg.command && (
                  <UserBubble command={msg.command} />
                )}
                {msg.role === "assistant" && msg.isThinking && msg.thinking && (
                  <ThinkingDisplay steps={msg.thinking} />
                )}
                {msg.role === "assistant" && !msg.isThinking && msg.result && (
                  <ResponseCard
                    result={msg.result}
                    onClose={() => setMessages([])}
                    onContinue={
                      msg.originalCommand
                        ? handleContinue(msg.originalCommand)
                        : undefined
                    }
                    onConfirm={
                      msg.originalCommand
                        ? handleConfirm(
                            msg.originalCommand,
                            msg.result.partialContext ?? {},
                          )
                        : undefined
                    }
                    onExplorerCmd={(cmd) => {
                      setCommand(cmd);
                      // Foca o input para o usuário completar o comando
                      setTimeout(() => {
                        const ta =
                          document.querySelector<HTMLTextAreaElement>(
                            "textarea",
                          );
                        ta?.focus();
                      }, 50);
                    }}
                  />
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Fixed bottom input — only in chat mode ── */}
      {hasMessages && (
        <div className="border-t border-zinc-800/60 bg-[#050510]/90 backdrop-blur px-3 sm:px-4 py-3 shrink-0 relative z-10">
          <div className="max-w-3xl mx-auto">
            <CommandInput {...commandInputProps} />
          </div>
        </div>
      )}
    </div>
  );
}
