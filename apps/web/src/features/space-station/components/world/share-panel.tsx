"use client";

/**
 * SharePanel — WorkAdventure-style world share panel.
 * Shown when the user clicks the Share button in the MediaBar.
 */

import { useState, useCallback } from "react";
import { X, Copy, Check, Globe, ExternalLink, QrCode } from "lucide-react";

interface Props {
  nick:    string;
  onClose: () => void;
}

export function SharePanel({ nick, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // Build the absolute URL
  const worldPath = `/station/${nick}/world`;
  const worldUrl  =
    typeof window !== "undefined"
      ? `${window.location.origin}${worldPath}`
      : worldPath;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(worldUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = worldUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [worldUrl]);

  // Simple QR URL via goqr.me (no SDK needed)
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&bgcolor=0f172a&color=a5b4fc&data=${encodeURIComponent(worldUrl)}`;

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 w-[360px] bg-slate-900/98 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <Globe className="h-3.5 w-3.5 text-indigo-400" />
            </div>
            <div>
              <p className="text-white text-sm font-semibold leading-tight">Compartilhar este mundo</p>
              <p className="text-slate-500 text-[10px] leading-tight">@{nick}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 flex items-center justify-center transition-all"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Description */}
          <p className="text-slate-400 text-xs leading-relaxed">
            Qualquer pessoa com este link pode entrar no seu mundo virtual como visitante.
          </p>

          {/* URL field + copy */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 bg-slate-800/80 border border-white/8 rounded-xl px-3 py-2.5">
              <p className="text-indigo-300 text-[11px] font-mono truncate select-all">{worldUrl}</p>
            </div>
            <button
              onClick={handleCopy}
              title={copied ? "Copiado!" : "Copiar link"}
              className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                copied
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white"
              }`}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          {/* Copy confirmation toast */}
          {copied && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
              <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
              <span className="text-emerald-400 text-xs font-medium">Link copiado para a área de transferência!</span>
            </div>
          )}

          {/* Actions row */}
          <div className="flex items-center gap-2">
            {/* Open in new tab */}
            <a
              href={worldPath}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 flex-1 justify-center bg-slate-800/80 hover:bg-slate-700/80 border border-white/8 text-slate-300 hover:text-white text-xs font-medium px-3 py-2 rounded-xl transition-all"
            >
              <ExternalLink className="h-3 w-3" />
              Abrir em nova aba
            </a>

            {/* QR Code toggle */}
            <button
              onClick={() => setShowQr(v => !v)}
              className={`flex items-center gap-1.5 flex-1 justify-center border text-xs font-medium px-3 py-2 rounded-xl transition-all ${
                showQr
                  ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-300"
                  : "bg-slate-800/80 hover:bg-slate-700/80 border-white/8 text-slate-300 hover:text-white"
              }`}
            >
              <QrCode className="h-3 w-3" />
              QR Code
            </button>
          </div>

          {/* QR Code */}
          {showQr && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-[148px] h-[148px] rounded-xl bg-slate-800 border border-white/8 flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrSrc}
                  alt="QR Code do mundo"
                  width={140}
                  height={140}
                  className="rounded-lg"
                />
              </div>
              <p className="text-slate-500 text-[10px] text-center">
                Escaneie para entrar no mundo <span className="text-indigo-400">@{nick}</span>
              </p>
            </div>
          )}

          {/* Access info */}
          <div className="flex items-start gap-2 bg-slate-800/40 border border-white/6 rounded-xl px-3 py-2.5">
            <Globe className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <p className="text-slate-400 text-[10px] leading-relaxed">
              Mundo <span className="text-white font-medium">público</span> · Qualquer pessoa com o link pode entrar sem precisar de conta.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
