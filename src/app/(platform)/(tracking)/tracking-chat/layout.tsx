"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ConversationsList } from "@/features/tracking-chat/components/conversations-list";
import { InChatActiveBanner } from "@/features/tracking-chat/components/in-chat-active-banner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useParams, useSearchParams } from "next/navigation";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const isMobile = useIsMobile();
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
      <div className="flex-1 min-h-0 flex">
        <ResizablePanelGroup>
          {!isMobile && (
            <>
              <ResizablePanel defaultSize={"15%"} minSize={250} maxSize={"30%"}>
                <ConversationsList />
              </ResizablePanel>
              <ResizableHandle
                withHandle
                className="outline-none data-[separator=hover]:bg-zinc-600 data-[separator=active]:bg-zinc-700  data-[separator=active]: transition-colors duration-150"
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
