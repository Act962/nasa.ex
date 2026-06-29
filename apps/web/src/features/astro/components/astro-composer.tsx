"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SendIcon, StopCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AstroComposerProps {
  status: "submitted" | "streaming" | "ready" | "error";
  onSend: (text: string) => Promise<void> | void;
  onStop: () => void;
  /** Texto inicial — usado quando o usuário escolhe um exemplo no welcome. */
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Input do ASTRO. Textarea com auto-submit no Enter (Shift+Enter quebra
 * linha). Botão alterna entre Enviar (ready/error) e Parar (submitted/
 * streaming). Tudo "controlado externamente" pelo `useAstroChat`.
 */
export function AstroComposer({
  status,
  onSend,
  onStop,
  defaultValue,
  placeholder = "Pergunte algo ao ASTRO…",
  disabled,
  className,
}: AstroComposerProps) {
  const [text, setText] = useState(defaultValue ?? "");
  const isBusy = status === "submitted" || status === "streaming";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isBusy || disabled) return;
    setText("");
    await onSend(trimmed);
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e as unknown as FormEvent);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex items-end gap-2 border-t bg-background p-2", className)}
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="max-h-40 min-h-10 flex-1 resize-none"
      />
      {isBusy ? (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={onStop}
          aria-label="Parar"
        >
          <StopCircleIcon className="size-4" />
        </Button>
      ) : (
        <Button
          type="submit"
          size="icon"
          disabled={disabled || text.trim().length === 0}
          aria-label="Enviar"
        >
          <SendIcon className="size-4" />
        </Button>
      )}
    </form>
  );
}
