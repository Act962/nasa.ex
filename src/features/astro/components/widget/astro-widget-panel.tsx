"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { UIMessage } from "ai";
import { Loader2 } from "lucide-react";
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

  return (
    <section
      role="dialog"
      aria-label="Chat com o Astro"
      hidden={!isOpen}
      className="fixed inset-x-0 bottom-0 z-[9050] flex h-[85dvh] flex-col overflow-hidden rounded-t-[22px] border border-white/10 bg-[#0d0d12] text-white shadow-[0_30px_70px_-20px_rgba(0,0,0,0.6)] sm:inset-x-auto sm:bottom-20 sm:right-5 sm:h-[min(620px,calc(100dvh-7rem))] sm:w-[400px] sm:rounded-[22px]"
    >
      <AstroWidgetSession />
    </section>
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
      <div className="grid flex-1 place-items-center text-white/40" role="status" aria-label="Carregando conversa">
        <Loader2 className="size-5 animate-spin" />
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
