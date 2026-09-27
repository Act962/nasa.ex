"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ConversationsList } from "@/features/tracking-chat/components/conversations-list";
import { InChatActiveBanner } from "@/features/tracking-chat/components/in-chat-active-banner";
import { useIsMobileOrTablet } from "@/hooks/use-mobile";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useRef } from "react";

const CHAT_LIST_WIDTH_VARIABLE = "--chat-list-width";

/**
 * Publica a largura da lista de conversas numa variável CSS: a lateral
 * "Detalhes do Lead" usa a mesma largura e acompanha o redimensionamento.
 */
function useChatListWidthVariable() {
  const observerRef = useRef<ResizeObserver | null>(null);
  return useCallback((element: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const width = Math.round(element.getBoundingClientRect().width);
      document.documentElement.style.setProperty(CHAT_LIST_WIDTH_VARIABLE, `${width}px`);
    });
    observer.observe(element);
    observerRef.current = observer;
  }, []);
}

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  // Tablets (<1024px) recebem a mesma UX de smartphone: 1 painel por vez
  // (lista OU chat, nunca ambos lado a lado). Layout de 2 colunas só
  // entra em ≥lg, onde tem espaço pra resizable panels sem apertar.
  const isMobile = useIsMobileOrTablet();
  const listPanelRef = useChatListWidthVariable();
  const { conversationId } = useParams();
  const searchParams = useSearchParams();
  // trackingId vem como query param `?trackingId=...` na URL.
  const trackingId = searchParams?.get("trackingId") ?? null;

  // Banner global do In-Chat — só aparece quando a instância está em
  // modo anti-ban. Inserido no topo do layout pra ser visível tanto na
  // lista de conversas quanto na conversa aberta.
  const banner = trackingId ? (
    <InChatActiveBanner trackingId={trackingId} />
  ) : null;

  if (isMobile && !conversationId) {
    return (
      <div className="h-screen flex flex-col w-full overflow-hidden">
        {banner}
        <div className="flex-1 min-h-0 flex">
          <ConversationsList />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col w-full overflow-hidden">
      {banner}
      <div className="flex-1 min-h-0 flex lg:bg-zinc-300 lg:p-3">
        <ResizablePanelGroup>
          {!isMobile && (
            <>
              <ResizablePanel defaultSize={"15%"} minSize={250} maxSize={"30%"}>
                {/* Blocos em cartão, com cantos arredondados e respiro entre eles. */}
                <div ref={listPanelRef} className="h-full overflow-hidden rounded-2xl border bg-background">
                  <ConversationsList />
                </div>
              </ResizablePanel>
              <ResizableHandle
                withHandle
                className="mx-1.5 w-0 bg-transparent outline-none data-[separator=hover]:bg-zinc-600 data-[separator=active]:bg-zinc-700 transition-colors duration-150"
              />
            </>
          )}
          <ResizablePanel
            className="flex-1"
            defaultSize={"85%"}
            minSize={"50%"}
            maxSize={"80%"}
          >
            {children}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
