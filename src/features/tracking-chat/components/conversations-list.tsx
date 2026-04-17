"use client";

import { LeadBox } from "./lead-box";
import { ConversationFilters } from "./conversation-filters";
import { SettingsIcon, UserPlusIcon, UserRoundPlusIcon } from "lucide-react";
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
import { LeadSource } from "@/generated/prisma/enums";
import { WhatsAppInstanceStatus } from "@/generated/prisma/enums";
import { pusherClient } from "@/lib/pusher";
import { orpc } from "@/lib/orpc";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SearchConversations } from "./search-conversaitons";
import { useDebouncedValue } from "@/hooks/use-debounced";
import { Instance } from "../types";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useParams, useRouter } from "next/navigation";

export function ConversationsList() {
  const { conversationId, trackingId } = useParams<{
    conversationId: string;
    trackingId?: string;
  }>();
  const [open, setOpen] = useState(false);
  const { trackings, isLoadingTrackings } = useQueryTracking();
  const [selectedTracking, setSelectedTracking] = useState<string>(
    trackingId ?? "",
  );
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<
    "ALL" | "WHATSAPP" | "INSTAGRAM" | "TIKTOK" | "FACEBOOK"
  >("ALL");
  const [statusFlowFilter, setStatusFlowFilter] = useState<
    "FINISHED" | "ACTIVE" | null
  >(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const debouncedSearch = useDebouncedValue(search, 500);
  const router = useRouter();

  const scrollRef = useRef<HTMLDivElement>(null);

  useInfinityConversation(
    selectedTracking,
    selectedStatus,
    debouncedSearch,
    conversationId,
  );

  const infinitiOptions = orpc.conversation.list.infiniteOptions({
    input: (pageParam: string | undefined) => ({
      trackingId: selectedTracking,
      statusId: selectedStatus,
      search: debouncedSearch,
      cursor: pageParam,
      limit: 15,
    }),
    queryKey: [
      "conversations.list",
      selectedTracking,
      selectedStatus,
      debouncedSearch,
    ],
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

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (!matchesChannel(item, selectedChannel)) {
        return false;
      }

      if (statusFlowFilter && item.lead.statusFlow !== statusFlowFilter) {
        return false;
      }

      if (favoritesOnly && !isFavoriteConversation(item)) {
        return false;
      }

      if (
        selectedTagIds.length > 0 &&
        !selectedTagIds.some((tagId) =>
          item.lead.leadTags?.some((leadTag) => leadTag.tag.id === tagId),
        )
      ) {
        return false;
      }

      return true;
    });
  }, [items, selectedChannel, statusFlowFilter, favoritesOnly, selectedTagIds]);

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
    if (!isLoadingTrackings && trackings.length > 0 && !selectedTracking) {
      setSelectedTracking(trackings[0].id);
    }
  }, [trackings, isLoadingTrackings, selectedTracking]);

  useEffect(() => {
    if (!selectedTracking) return;
    pusherClient.subscribe(selectedTracking);

    return () => {
      pusherClient.unsubscribe(selectedTracking);
    };
  }, [selectedTracking]);

  const instance: Instance | undefined = whatsappInstance
    ? {
        token: whatsappInstance.apiKey,
        isBusiness: whatsappInstance.isBusiness,
        phoneNumber: whatsappInstance.phoneNumber,
      }
    : undefined;

  const pageSettings = selectedTracking
    ? `/tracking/${selectedTracking}/settings`
    : "/tracking/";

  const handleTrackingChange = (id: string) => {
    if (id === selectedTracking) return;
    setSelectedTracking(id);
    setSelectedStatus(null);
    setSelectedTagIds([]);
  };

  return (
    <>
      <aside className="pb-20 lg:pb-0 lg:flex w-full px-5 flex flex-col h-full overflow-hidden">
        <div className="flex justify-between mb-4 pt-4 shrink-0">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="size-4" />
            <div className="text-lg font-medium">Tracking Chat</div>
          </div>
          <div className="flex items-center ">
            {!noInstance && !instanceDisconnected && !isLoadingTrackings && (
              <div className="cursor-pointer">
                <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
                  <UserRoundPlusIcon className="size-4" />
                </Button>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(pageSettings)}
            >
              <SettingsIcon className="size-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          <Select value={selectedTracking} onValueChange={handleTrackingChange}>
            <SelectTrigger
              className="w-full h-10 rounded-lg bg-background border border-input px-3 text-sm"
              disabled={isLoadingTrackings || trackings.length === 0}
            >
              <SelectValue placeholder="Selecionar tracking" />
            </SelectTrigger>
            <SelectContent align="start" className="w-(--radix-select-trigger-width)">
              <SelectGroup>
                {trackings.map((tracking) => (
                  <SelectItem key={tracking.id} value={tracking.id}>
                    {tracking.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <SearchConversations
            search={search}
            onSearchChange={setSearch}
            trackingId={selectedTracking || null}
            onTrackingChange={(id: string | null) =>
              handleTrackingChange(id ?? "")
            }
            statusId={selectedStatus}
            onStatusChange={setSelectedStatus}
          />
          <ConversationFilters
            trackingId={selectedTracking || null}
            selectedChannel={selectedChannel}
            onChannelChange={setSelectedChannel}
            statusFlowFilter={statusFlowFilter}
            onStatusFlowFilterChange={setStatusFlowFilter}
            favoritesOnly={favoritesOnly}
            onFavoritesOnlyChange={setFavoritesOnly}
            selectedTagIds={selectedTagIds}
            onSelectedTagIdsChange={setSelectedTagIds}
          />

          {isLoading || isLoadingTrackings ? (
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto mt-2 min-h-0">
              {Array.from({ length: 10 }).map((_, index) => (
                <Skeleton key={index} className="h-16 mt-1" />
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {filteredItems.length === 0 && (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <UserPlusIcon />
                    </EmptyMedia>
                    <EmptyTitle>Sem conversas</EmptyTitle>
                    <EmptyDescription>
                      Nenhuma conversa encontrada com os filtros atuais
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
                {filteredItems.map((item) => (
                  <LeadBox
                    instance={instance}
                    key={item.id}
                    item={item}
                    unreadCount={(item as any).unreadCount}
                    lastMessage={{
                      body: item.lastMessage?.body || null,
                      createdAt: item.lastMessage?.createdAt,
                      mimetype: (item.lastMessage as any)?.mimetype,
                      fileName: (item.lastMessage as any)?.fileName,
                    }}
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

function matchesChannel(
  item: {
    lead: {
      source: LeadSource;
    };
  },
  selectedChannel: "ALL" | "WHATSAPP" | "INSTAGRAM" | "TIKTOK" | "FACEBOOK",
) {
  if (selectedChannel === "ALL") {
    return true;
  }

  // A tela de Tracking Chat hoje é alimentada pela instância de WhatsApp
  // configurada no tracking. Ao selecionar WhatsApp, não filtramos nada
  // para garantir que todos os leads dessa instância apareçam.
  if (selectedChannel === "WHATSAPP") {
    return true;
  }

  if (selectedChannel === "FACEBOOK") {
    return item.lead.source === LeadSource.OTHER;
  }

  return item.lead.source === selectedChannel;
}

function isFavoriteConversation(item: {
  lead: {
    leadTags?: {
      tag: {
        name: string;
        slug: string;
      };
    }[];
  };
}) {
  return (
    item.lead.leadTags?.some(({ tag }) => {
      const normalizedName = tag.name.toLowerCase();
      const normalizedSlug = tag.slug.toLowerCase();

      return (
        normalizedName.includes("favorit") ||
        normalizedSlug.includes("favorit") ||
        normalizedName.includes("star") ||
        normalizedSlug.includes("star")
      );
    }) ?? false
  );
}
