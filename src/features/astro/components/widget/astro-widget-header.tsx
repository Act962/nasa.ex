"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Plus, Settings, X } from "lucide-react";
import { AstroMark } from "@/features/astro/components/astro-mark";
import { AstroVoiceMenuItems } from "@/features/astro/voice/astro-voice-menu";
import { usePaymentTabStore } from "@/features/payment/store/use-payment-tab-store";
import { resolveWidgetScreenContext } from "@/features/astro/lib/widget-screen-context";

/** Cabeçalho do painel: marca, App aberto, nova conversa, voz e (no celular) fechar. */

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
  const paymentTab = usePaymentTabStore((state) => state.activeTab);

  return (
    <header className="relative flex shrink-0 items-center gap-2 px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-info p-px">
        <AstroMark />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Astro</p>
        <p className="truncate text-[11px] text-foreground/40">{resolveWidgetScreenContext(pathname, paymentTab).screenLabel}</p>
      </div>

      {canStartNewConversation && (
        <button
          type="button"
          onClick={onNewConversation}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] text-foreground/70 transition hover:bg-foreground/[0.1] hover:text-foreground"
        >
          <Plus className="size-3" />
          Nova conversa
        </button>
      )}

      {/* O App ASTRO saiu do menu lateral: o caminho até ele é esta
          engrenagem, que acompanha o widget em todas as telas. */}
      <Link
        href="/astro"
        onClick={onClose}
        aria-label="Abrir o App ASTRO"
        title="Configurações do ASTRO"
        className="grid size-8 shrink-0 place-items-center rounded-full text-foreground/45 transition hover:bg-foreground/[0.06] hover:text-foreground"
      >
        <Settings className="size-4" />
      </Link>
      <button
        type="button"
        onClick={() => setVoiceMenuOpen((isMenuOpen) => !isMenuOpen)}
        aria-label="Opções de voz"
        aria-expanded={voiceMenuOpen}
        className="grid size-8 shrink-0 place-items-center rounded-full text-foreground/45 transition hover:bg-foreground/[0.06] hover:text-foreground"
      >
        <MoreHorizontal className="size-4" />
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar o chat"
        // No computador o fechar fica do lado de fora do painel (AstroWidgetPanel).
        className="grid size-8 shrink-0 sm:hidden place-items-center rounded-full text-foreground/45 transition hover:bg-foreground/[0.06] hover:text-foreground"
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
            className="absolute right-3 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line/60 bg-card/95 shadow-xl backdrop-blur"
          >
            <AstroVoiceMenuItems onAction={() => setVoiceMenuOpen(false)} />
          </div>
        </>
      )}
    </header>
  );
}
