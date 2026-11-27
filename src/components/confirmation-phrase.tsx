"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ConfirmationPhraseProps {
  phrase: string;
  className?: string;
}

/** Texto que o usuário precisa digitar para confirmar, com botão de copiar. */
export function ConfirmationPhrase({ phrase, className }: ConfirmationPhraseProps) {
  const [hasCopied, setHasCopied] = useState(false);

  async function onCopyPhrase() {
    try {
      await navigator.clipboard.writeText(phrase);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-semibold text-foreground",
        className,
      )}
    >
      {phrase}
      <button
        type="button"
        onClick={onCopyPhrase}
        className="text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Copiar texto de confirmação"
      >
        {hasCopied ? (
          <CheckIcon className="size-3.5 text-success" />
        ) : (
          <CopyIcon className="size-3.5" />
        )}
      </button>
    </span>
  );
}
