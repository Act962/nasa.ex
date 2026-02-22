"use client";

import { LeadBox } from "./lead-box";
import { UserPlusIcon, UserRoundPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInfinityConversation } from "../hooks/use-conversation";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { CreateChatDialog } from "./create-chat-dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryTracking } from "@/features/tracking-settings/hooks/use-tracking";
import { WhatsAppInstanceStatus } from "@/generated/prisma/enums";
import { pusherClient } from "@/lib/pusher";
import { orpc } from "@/lib/orpc";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SearchConversations } from "./search-conversaitons";
import { useMessageStore } from "../context/use-message";

export function ConversationsList() {
  const [open, setOpen] = useState(false);
  const { trackings, isLoadingTrackings } = useQueryTracking();
  const [selectedTracking, setSelectedTracking] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoadingTrackings && trackings.length > 0 && !selectedTracking) {
      setSelectedTracking(trackings[0].id);
    }
  }, [trackings, isLoadingTrackings, selectedTracking]);

  useInfinityConversation(selectedTracking, selectedStatus, search);

  const infinitiOptions = orpc.conversation.list.infiniteOptions({
    input: (pageParam: string | undefined) => ({
      trackingId: selectedTracking,
      statusId: selectedStatus,
      search: search,
      cursor: pageParam,
      limit: 15,
    }),
    queryKey: ["conversations.list", selectedTracking, selectedStatus, search],
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      ...infinitiOptions,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      enabled: !!selectedTracking,
    });

  const items = useMemo(() => {
    return data?.pages.flatMap((p) => p.items) ?? [];
  }, [data]);

  const isNearBottom = (el: HTMLDivElement) =>
    el.scrollHeight - el.scrollTop - el.clientHeight <= 80;

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;

    if (isNearBottom(el)) {
      fetchNextPage();
    }
  };

  const currentTracking = trackings.find((t) => t.id === selectedTracking);
  const whatsappInstance = currentTracking?.whatsappInstance;
  const noInstance = !whatsappInstance;
  const instanceDisconnected =
    whatsappInstance?.status === WhatsAppInstanceStatus.DISCONNECTED;

  useEffect(() => {
    if (!selectedTracking) return;
    pusherClient.subscribe(selectedTracking);

    return () => {
      pusherClient.unsubscribe(selectedTracking);
    };
  }, [selectedTracking]);

  const token = trackings.find((t) => t.id === selectedTracking)
    ?.whatsappInstance?.apiKey;

  return (
    <>
      <aside className="pb-20 lg:pb-0 lg:flex w-full px-5 flex flex-col h-full overflow-hidden">
        <div className="flex justify-between mb-4 pt-4 shrink-0">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="size-4" />
            <div className="text-lg font-medium">Tracking Chat</div>
          </div>
          {!noInstance && !instanceDisconnected && !isLoadingTrackings && (
            <div className="cursor-pointer">
              <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
                <UserRoundPlusIcon className="size-4" />
              </Button>
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          <SearchConversations
            search={search}
            onSearchChange={setSearch}
            trackingId={selectedTracking || null}
            onTrackingChange={(id: string | null) =>
              setSelectedTracking(id ?? "")
            }
            statusId={selectedStatus}
            onStatusChange={setSelectedStatus}
          />

          {isLoading || isLoadingTrackings ? (
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto mt-2 min-h-0">
              {Array.from({ length: 10 }).map((_, index) => (
                <Skeleton key={index} className="h-16 mt-1" />
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {items.length === 0 && (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <UserPlusIcon />
                    </EmptyMedia>
                    <EmptyTitle>Sem conversas</EmptyTitle>
                    <EmptyDescription>
                      Nenhuma conversa encontrada
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button variant="default" onClick={() => setOpen(true)}>
                      Adicionar conversa
                    </Button>
                  </EmptyContent>
                </Empty>
              )}
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="overflow-y-auto flex flex-col gap-2 flex-1 pb-4 scroll-cols-tracking min-h-0"
              >
                {items.map((item) => (
                  <LeadBox
                    token={token}
                    key={item.id}
                    item={item}
                    lastMessageText={item.lastMessage?.body}
                  />
                ))}
                {isFetchingNextPage && (
                  <div className="flex justify-center py-4">
                    <Spinner className="size-4" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
      <CreateChatDialog
        trackingId={selectedTracking}
        token={whatsappInstance?.apiKey!}
        isOpen={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
