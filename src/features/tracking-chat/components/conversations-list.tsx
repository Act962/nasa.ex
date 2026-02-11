"use client";

import { LeadBox } from "./lead-box";
import { RocketIcon, UserPlusIcon, UserRoundPlusIcon } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryTracking } from "@/features/tracking-settings/hooks/use-tracking";
import { WhatsAppInstanceStatus } from "@/generated/prisma/enums";
import Link from "next/link";
import { pusherClient } from "@/lib/pusher";
import { orpc } from "@/lib/orpc";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useParams } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function ConversationsList() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const isOpen = !!conversationId;
  const [open, setOpen] = useState(false);
  const { trackings, isLoadingTrackings } = useQueryTracking();
  const [selectedTracking, setSelectedTracking] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoadingTrackings && trackings.length > 0 && !selectedTracking) {
      setSelectedTracking(trackings[0].id);
    }
  }, [trackings, isLoadingTrackings, selectedTracking]);

  useInfinityConversation(selectedTracking);

  const infinitiOptions = orpc.conversation.list.infiniteOptions({
    input: (pageParam: string | undefined) => ({
      trackingId: selectedTracking,
      cursor: pageParam,
      limit: 10,
    }),
    queryKey: ["conversations.list", selectedTracking],
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
  const whatsappInstance = currentTracking?.whatsappInstances?.[0];
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

  if (isLoading || isLoadingTrackings) {
    return (
      <aside
        className={cn(
          "pb-20 lg:pb-0 lg:w-80 lg:block overflow-y-auto border-r border-foreground/10 block w-full",
          isOpen ? "hidden" : "block w-full",
        )}
      >
        <div className="px-5">
          <div className="flex justify-between mb-4 pt-4">
            <div className="text-lg font-medium">Tracking Chat</div>
          </div>
          <div className="flex-1 flex flex-col gap-2 min-h-0">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton key={index} className="h-16 mt-1" />
            ))}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <>
      <aside
        className={cn(
          "pb-20 lg:pb-0 lg:w-80 lg:block border-r border-foreground/10 block w-full overflow-hidden",
          isOpen ? "hidden" : "block w-full",
        )}
      >
        <div className="px-5 flex flex-col h-full">
          <div className="flex justify-between mb-4 pt-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="size-4" />
              <div className="text-lg font-medium">Tracking Chat</div>
            </div>
            {!noInstance && !instanceDisconnected && (
              <div className="cursor-pointer">
                <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
                  <UserRoundPlusIcon className="size-4" />
                </Button>
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col gap-2 min-h-0">
            <Select
              onValueChange={(value) => setSelectedTracking(value)}
              value={selectedTracking}
              disabled={isLoadingTrackings}
              defaultValue={trackings[0]?.id}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {trackings.map((tracking) => (
                    <SelectItem key={tracking.id} value={tracking.id}>
                      {tracking.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            {noInstance || instanceDisconnected ? (
              <div className="flex-1 overflow-hidden">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia>
                      <RocketIcon />
                    </EmptyMedia>
                    <EmptyTitle>
                      {noInstance
                        ? "Nenhuma instância encontrada"
                        : "Instância desconectada"}
                    </EmptyTitle>
                    <EmptyDescription>
                      {noInstance
                        ? "Configure uma instância para iniciar"
                        : "Conecte a instância para iniciar"}
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button variant="default" asChild>
                      <Link
                        href={`/tracking/${selectedTracking}/settings?tab=instance`}
                      >
                        Configurar Instância
                      </Link>
                    </Button>
                  </EmptyContent>
                </Empty>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
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
                  className="overflow-y-auto flex flex-col gap-2 flex-1 pb-4 scroll-cols-tracking"
                >
                  {items.map((item) => (
                    <LeadBox
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
