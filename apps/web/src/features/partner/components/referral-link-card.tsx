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
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-white mb-1">
        Seu link de indicação
      </h2>
      <p className="text-xs text-zinc-500 mb-4">
        Compartilhe e cada empresa cadastrada conta para o seu nível.
      </p>

      <div className="flex gap-2 items-center">
        <input
          readOnly
          value={url}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
        />
        <button
          onClick={onCopy}
          className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          <Copy className="w-4 h-4" />
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-zinc-800/40 rounded-lg p-3">
          <div className="flex items-center gap-2 text-zinc-400 text-xs">
            <Eye className="w-3 h-3" /> Visitas
          </div>
          <div className="text-white font-semibold mt-1">
            {visits.toLocaleString("pt-BR")}
          </div>
        </div>
        <div className="bg-zinc-800/40 rounded-lg p-3">
          <div className="flex items-center gap-2 text-zinc-400 text-xs">
            <UserPlus className="w-3 h-3" /> Cadastros
          </div>
          <div className="text-white font-semibold mt-1">
            {signups.toLocaleString("pt-BR")}
          </div>
        </div>
      </div>
    </div>
  );
}
