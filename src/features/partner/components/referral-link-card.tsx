"use client";

import { Copy, Eye, UserPlus } from "lucide-react";
import { useState } from "react";

export function ReferralLinkCard({
  code,
  visits,
  signups,
}: {
  code: string;
  visits: number;
  signups: number;
}) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/sign-up?ref=${code}`
      : `/sign-up?ref=${code}`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="bg-card border border-line rounded-xl p-5">
      <h2 className="text-sm font-semibold text-foreground mb-1">
        Seu link de indicação
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        Compartilhe e cada empresa cadastrada conta para o seu nível.
      </p>

      <div className="flex gap-2 items-center">
        <input
          readOnly
          value={url}
          className="flex-1 bg-muted border border-line rounded-full px-4 py-2 text-sm text-foreground font-mono"
        />
        <button
          onClick={onCopy}
          className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold px-4 py-2 rounded-full transition-colors flex items-center gap-2"
        >
          <Copy className="w-4 h-4" />
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-muted/40 rounded-lg p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Eye className="w-3 h-3" /> Visitas
          </div>
          <div className="text-foreground font-semibold mt-1">
            {visits.toLocaleString("pt-BR")}
          </div>
        </div>
        <div className="bg-muted/40 rounded-lg p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <UserPlus className="w-3 h-3" /> Cadastros
          </div>
          <div className="text-foreground font-semibold mt-1">
            {signups.toLocaleString("pt-BR")}
          </div>
        </div>
      </div>
    </div>
  );
}
