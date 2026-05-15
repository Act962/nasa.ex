"use client";

import {
  isToolUIPart,
  isTextUIPart,
  isReasoningUIPart,
  type UIMessage,
} from "ai";
import { cn } from "@/lib/utils";
import {
  CheckIcon,
  Loader2Icon,
  WrenchIcon,
  XIcon,
  AlertTriangleIcon,
} from "lucide-react";

/**
 * Render de uma `UIMessage` do AI SDK.
 *
 * Cobre os tipos de part do MVP:
 *   - text         → bolha de chat (cinza para user, claro para assistant).
 *   - tool-*       → chip com nome da tool, estado e input/output em <details>.
 *   - reasoning    → bloco italic clarinho (modelos thinking).
 *
 * Não tenta ser exaustivo (file/source/data parts ficam sem render no MVP).
 */
export function AstroMessage({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2 px-3 py-2",
        isUser ? "items-end" : "items-start",
      )}
    >
      {message.parts.map((part, idx) => {
        if (isTextUIPart(part)) {
          return (
            <div
              key={idx}
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
                isUser
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              {part.text}
            </div>
          );
        }

        if (isReasoningUIPart(part)) {
          return (
            <div
              key={idx}
              className="max-w-[85%] rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs italic text-muted-foreground"
            >
              {part.text}
            </div>
          );
        }

        if (isToolUIPart(part)) {
          // Tools de roteamento pra sub-agente são representadas pelo
          // foguete + label no ThinkingDisplay. Esconde o chip cru aqui
          // pra não duplicar info e poluir a conversa.
          const toolName =
            part.type === "dynamic-tool"
              ? ((part as { toolName?: string }).toolName ?? "")
              : part.type.replace(/^tool-/, "");
          if (toolName.startsWith("route_to_")) {
            return null;
          }
          return <ToolPart key={idx} part={part} />;
        }

        return null;
      })}

      {/* Token counter no rodapé das respostas do assistant (silencioso —
          sem mostrar valor em Stars; cobrança é debitada server-side). */}
      {!isUser &&
        (() => {
          const tokens = (message as { metadata?: { tokens?: number } })
            .metadata?.tokens;
          if (typeof tokens !== "number" || tokens <= 0) return null;
          return (
            <span className="text-[10px] text-muted-foreground/60 px-1">
              {tokens.toLocaleString("pt-BR")} tokens
            </span>
          );
        })()}
    </div>
  );
}

function ToolPart({
  part,
}: {
  part: Extract<
    UIMessage["parts"][number],
    { type: `tool-${string}` } | { type: "dynamic-tool" }
  >;
}) {
  // type vem como "tool-search_lead", "tool-route_to_closer", "dynamic-tool", etc.
  const toolName =
    part.type === "dynamic-tool"
      ? ((part as { toolName?: string }).toolName ?? "dynamic")
      : part.type.replace(/^tool-/, "");
  const state = (part as { state?: string }).state ?? "input-streaming";

  const { Icon, label, tone } = stateUI(state);

  const input = (part as { input?: unknown }).input;
  const output = (part as { output?: unknown }).output;
  const errorText = (part as { errorText?: string }).errorText;

  return (
    <div
      className={cn(
        "flex w-full max-w-[85%] flex-col gap-1 rounded-md border bg-background px-2.5 py-1.5 text-xs",
        tone,
      )}
    >
      <div className="flex items-center gap-2">
        <WrenchIcon className="size-3.5" />
        <span className="font-mono text-[11px]">{toolName}</span>
        <span className="ml-auto flex items-center gap-1 text-[10px] uppercase tracking-wide">
          <Icon className="size-3" />
          {label}
        </span>
      </div>
      {(input !== undefined ||
        output !== undefined ||
        errorText !== undefined) && (
        <details className="text-[11px]">
          <summary className="cursor-pointer select-none text-muted-foreground">
            detalhes
          </summary>
          {input !== undefined && (
            <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-1.5">
              {JSON.stringify(input, null, 2)}
            </pre>
          )}
          {output !== undefined && (
            <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-1.5">
              {JSON.stringify(output, null, 2)}
            </pre>
          )}
          {errorText && (
            <pre className="mt-1 overflow-x-auto rounded bg-destructive/10 p-1.5 text-destructive">
              {errorText}
            </pre>
          )}
        </details>
      )}
    </div>
  );
}

function stateUI(state: string) {
  switch (state) {
    case "output-available":
      return {
        Icon: CheckIcon,
        label: "ok",
        tone: "border-emerald-500/40 bg-emerald-500/5",
      };
    case "output-error":
      return {
        Icon: AlertTriangleIcon,
        label: "erro",
        tone: "border-destructive/40 bg-destructive/5 text-destructive",
      };
    case "input-available":
      return {
        Icon: Loader2Icon,
        label: "executando",
        tone: "border-amber-500/40 bg-amber-500/5",
      };
    case "input-streaming":
    default:
      return {
        Icon: Loader2Icon,
        label: "preparando",
        tone: "border-muted bg-muted/30",
      };
  }
}
