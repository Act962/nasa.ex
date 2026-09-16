"use client";

import { useState } from "react";
import { MoreHorizontal, Plus, X } from "lucide-react";
import { AstroMark } from "@/features/astro/components/astro-mark";
import { AstroVoiceMenuItems } from "@/features/astro/voice/astro-voice-menu";

/** Cabeçalho do painel: marca, contexto da tela, nova conversa, voz e fechar. */

function describeScreen(pathname: string): string {
  if (pathname.startsWith("/payment")) return "No financeiro — pergunte sobre o que está na tela";
  if (pathname.startsWith("/tracking")) return "No tracking";
  if (pathname.startsWith("/agendas")) return "Na agenda";
  if (pathname.startsWith("/workspaces")) return "No workspace";
  return "Seu copiloto no NASA";
}

export function AstroWidgetHeader({
  pathname,
  canStartNewConversation,
  onNewConversation,
  onClose,
}: {
  pathname: string;
  canStartNewConversation: boolean;
  onNewConversation: () => void;
  onClose: () => void;
}) {
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(false);

  return (
    <header className="relative flex shrink-0 items-center gap-2 border-b border-white/[0.07] px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#0b1220] p-px">
        <AstroMark />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">Astro</p>
        <p className="truncate text-[11px] text-white/40">{describeScreen(pathname)}</p>
      </div>

      {canStartNewConversation && (
        <button
          type="button"
          onClick={onNewConversation}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/70 transition hover:bg-white/[0.1] hover:text-white"
        >
          <Plus className="size-3" />
          Nova conversa
        </button>
      )}

      <button
        type="button"
        onClick={() => setVoiceMenuOpen((isMenuOpen) => !isMenuOpen)}
        aria-label="Opções de voz"
        aria-expanded={voiceMenuOpen}
        className="grid size-8 shrink-0 place-items-center rounded-full text-white/45 transition hover:bg-white/[0.06] hover:text-white"
      >
        <MoreHorizontal className="size-4" />
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar o chat"
        className="grid size-8 shrink-0 place-items-center rounded-full text-white/45 transition hover:bg-white/[0.06] hover:text-white"
      >
        <X className="size-4" />
      </button>

      {voiceMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Fechar opções de voz"
            onClick={() => setVoiceMenuOpen(false)}
            className="fixed inset-0 z-10 cursor-default bg-transparent"
          />
          <div
            role="menu"
            className="absolute right-3 top-full z-20 mt-1 overflow-hidden rounded-xl border border-zinc-700/60 bg-zinc-900/95 shadow-xl backdrop-blur"
          >
            <AstroVoiceMenuItems onAction={() => setVoiceMenuOpen(false)} />
          </div>
        </>
      )}
    </header>
  );
}
