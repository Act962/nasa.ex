"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyBlock({ text }: { text: string }) {
  const [isCopied, setIsCopied] = useState(false);
  return (
    <div className="relative mt-2 rounded-xl bg-foreground p-3 pr-10 font-mono text-xs break-all text-background">
      {text}
      <button
        type="button"
        aria-label="Copiar"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 1500);
        }}
        className="absolute top-2 right-2 rounded-md p-1 text-background/70 hover:text-background"
      >
        {isCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}
