"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ConversationsList } from "@/features/tracking-chat/components/conversations-list";
import { useIsMobile } from "@/hooks/use-mobile";
import { useParams } from "next/navigation";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const isMobile = useIsMobile();
  const { conversationId } = useParams();

  if (isMobile && !conversationId) {
    return (
      <div className="h-screen flex w-full overflow-hidden">
        <ConversationsList />
      </div>
    );
  }

  return (
    <div className="h-screen flex w-full overflow-hidden">
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
  );
}
