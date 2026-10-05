"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { UIMessage } from "ai";
import { XIcon } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { AstroEmbedScope } from "@/features/astro/components/astro-provider";
import {
  readStoredWidgetSessionId,
  storeWidgetSessionId,
  useAstroWidgetStoredSession,
} from "@/features/astro/hooks/use-astro-widget-session";
import {
  ASTRO_OPEN_EVENT,
  type AstroOpenEventDetail,
} from "@/features/astro/lib/open-astro-widget";
import { useAstroWidgetStore } from "@/features/astro/voice/use-astro-widget-store";
import { AstroWidgetConversation } from "./astro-widget-conversation";
import { cn } from "@/lib/utils";
import { useOrbCenter } from "@/features/astro/hooks/use-orb-position";
import { computePanelRect } from "@/features/astro/lib/orb-layout";

/**
 * Painel de chat do Astro aberto pelo orb (spec 0015).
 *
 * Só monta depois da primeira abertura e, a partir daí, fecha escondendo em vez
 * de desmontar — assim uma resposta em andamento termina e vira contador no orb.
 * No /home o painel não existe: lá o chat ocupa a página.
 */

const PATHS_WITH_FULL_CHAT = ["/home"];

export function AstroWidgetPanel() {
  const pathname = usePathname();
  const isOpen = useAstroWidgetStore((state) => state.isOpen);
  const hasOpened = useAstroWidgetStore((state) => state.hasOpened);
  const open = useAstroWidgetStore((state) => state.open);
  const close = useAstroWidgetStore((state) => state.close);
  const { center: orbCenter, viewport, isMeasured } = useOrbCenter();

  useEffect(() => {
    const handleOpenRequest = (event: Event) => {
      const prompt = (event as CustomEvent<AstroOpenEventDetail>).detail?.prompt?.trim();
      open(prompt ? { text: prompt, fromVoice: false } : undefined);
    };
    window.addEventListener(ASTRO_OPEN_EVENT, handleOpenRequest);
    return () => window.removeEventListener(ASTRO_OPEN_EVENT, handleOpenRequest);
  }, [open]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  if (!hasOpened || PATHS_WITH_FULL_CHAT.includes(pathname)) return null;

  // O painel abre a partir de onde o usuário deixou o orb, sempre dentro da
  // tela. No celular (`null`) continua sendo a folha de baixo (spec 0029).
  const panelRect = isMeasured ? computePanelRect(orbCenter, viewport) : null;

  return (
    <>
    <section
      role="dialog"
      aria-label="Chat com o Astro"
      hidden={!isOpen}
      className={cn(
        "fixed z-[9050] flex flex-col overflow-hidden border border-foreground/10 bg-card text-foreground shadow-[0_30px_70px_-20px_rgba(0,0,0,0.6)]",
        panelRect
          ? "rounded-[22px]"
          : "inset-0 h-dvh border-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:inset-auto sm:bottom-20 sm:right-5 sm:h-[min(720px,calc(100dvh-7rem))] sm:w-[460px] sm:rounded-[22px] sm:border sm:pt-0 sm:pb-0",
      )}
      style={
        panelRect
          ? {
              left: panelRect.left,
              top: panelRect.top,
              width: panelRect.width,
              height: panelRect.height,
            }
          : undefined
      }
    >
      <AstroWidgetSession />
    </section>
    {/* No computador o fechar fica do lado de fora, no canto do painel; no celular (tela cheia) ele está no cabeçalho. */}
    {panelRect && isOpen && (
      <button
        type="button"
        onClick={close}
        aria-label="Fechar o chat"
        title="Fechar"
        className="fixed z-[9051] grid size-8 place-items-center rounded-full border border-line bg-card text-foreground/60 shadow-lg transition hover:scale-105 hover:text-foreground active:scale-95"
        style={{
          left: panelRect.left + panelRect.width - 20,
          top: Math.max(4, panelRect.top - 12),
        }}
      >
        <XIcon className="size-4" />
      </button>
    )}
    </>
  );
}

/** Restaura a conversa salva da aba antes de montar o chat. */
function AstroWidgetSession() {
  const [storedSessionId] = useState(readStoredWidgetSessionId);
  const storedSession = useAstroWidgetStoredSession(storedSessionId);

  useEffect(() => {
    if (storedSession.isError) storeWidgetSessionId(null);
  }, [storedSession.isError]);

  if (storedSessionId && storedSession.isLoading) {
    return (
      <div className="grid flex-1 place-items-center text-foreground/40" role="status" aria-label="Carregando conversa">
        <OrbitaSpinner className="size-5 " />
      </div>
    );
  }

  const resumedSession = storedSession.data?.session;
  const initialMessages = resumedSession
    ? (resumedSession.messages as unknown as UIMessage[])
    : undefined;

  return (
    <AstroEmbedScope initialSessionId={resumedSession ? resumedSession.id : null}>
      <AstroWidgetConversation initialMessages={initialMessages} />
    </AstroEmbedScope>
  );
}
