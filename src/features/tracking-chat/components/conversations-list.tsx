"use client";

import { LeadBox } from "./lead-box";
import { TrackingChatBottomTabs } from "./tracking-chat-bottom-tabs";
import { ConversationFilters } from "./conversation-filters";
import { ImportFromWhatsAppButton } from "./import-from-whatsapp-button";
import {
  PhoneIcon,
  SettingsIcon,
  UserPlusIcon,
  UserRoundPlusIcon,
  MoreHorizontalIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
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
import { playIncomingChatBeep } from "../lib/notification-sound";
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

import { useParams, useRouter, useSearchParams } from "next/navigation";

export function ConversationsList() {
  const { conversationId, trackingId } = useParams<{
    conversationId: string;
    trackingId?: string;
  }>();
  const searchParams = useSearchParams();
  const trackingIdFromQuery = searchParams.get("trackingId");
  const [open, setOpen] = useState(false);
  const { trackings, isLoadingTrackings } = useQueryTracking();
  const [selectedTracking, setSelectedTracking] = useState<string>(
    trackingId ?? trackingIdFromQuery ?? "",
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
  const [archivedOnly, setArchivedOnly] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const debouncedSearch = useDebouncedValue(search, 500);
  const router = useRouter();

  const scrollRef = useRef<HTMLDivElement>(null);

  useInfinityConversation(
    selectedTracking,
    selectedStatus,
    debouncedSearch,
    conversationId,
    statusFlowFilter,
    selectedChannel,
    selectedTagIds,
    favoritesOnly,
  );

  const infinitiOptions = orpc.conversation.list.infiniteOptions({
    input: (pageParam: string | undefined) => ({
      trackingId: selectedTracking,
      statusId: selectedStatus,
      search: debouncedSearch,
      cursor: pageParam,
      limit: 15,
      statusFlow: statusFlowFilter,
      channel: selectedChannel === "ALL" ? null : selectedChannel,
      tagIds: selectedTagIds,
      favoritesOnly: favoritesOnly || undefined,
      archivedOnly: archivedOnly || undefined,
    }),
    queryKey: [
      "conversations.list",
      selectedTracking,
      selectedStatus,
      debouncedSearch,
      statusFlowFilter ?? null,
      selectedChannel,
      selectedTagIds,
      favoritesOnly,
      archivedOnly,
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

  // Pin-to-top da conversa aberta — OPT-IN via `?pin=1` na URL. Antes era
  // automático (toda conversa selecionada subia), mas isso bagunçava o
  // contexto do operador quando ele clicava em conversas DENTRO de
  // /tracking-chat só pra dar uma olhada. Agora a UX é:
  //  - Operador chega aqui via o ícone do canal no card do kanban
  //    (`/tracking/<id>` → ícone WhatsApp/etc) com `?pin=1` → conversa
  //    sobe pro topo (faz sentido: ele tá iniciando atendimento desse lead)
  //  - Operador clica num LeadBox direto na lista → ordem natural mantida
  //    (não sobe), porque ele só tá navegando pra ver mensagens
  const pinSelected = searchParams.get("pin") === "1";
  const orderedItems = useMemo(() => {
    if (!conversationId || !pinSelected) return items;
    const idx = items.findIndex((it) => it.id === conversationId);
    if (idx <= 0) return items;
    const pinned = items[idx]!;
    return [pinned, ...items.slice(0, idx), ...items.slice(idx + 1)];
  }, [items, conversationId, pinSelected]);

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
    if (isLoadingTrackings || trackings.length === 0 || selectedTracking) return;
    const fromQuery =
      trackingIdFromQuery && trackings.find((t) => t.id === trackingIdFromQuery);
    const id = fromQuery ? fromQuery.id : trackings[0].id;
    setSelectedTracking(id);
    if (!trackingIdFromQuery) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("trackingId", id);
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }, [
    trackings,
    isLoadingTrackings,
    selectedTracking,
    trackingIdFromQuery,
    searchParams,
    router,
  ]);

  useEffect(() => {
    if (!selectedTracking) return;
    const channel = pusherClient.subscribe(selectedTracking);

    // Notificação sonora pra mensagens inbound que chegam via in-chat
    // (widget público da page NASA Pages). Funciona mesmo se o atendente
    // não tiver a conversa aberta — fica monitorando o channel do
    // tracking inteiro. O cooldown interno de 1.5s no
    // `playIncomingChatBeep` evita duplicação se o Body também tocar
    // pra mesma mensagem.
    const handler = (body: { fromMe?: boolean; viaInChat?: boolean }) => {
      if (body?.fromMe === false && body?.viaInChat === true) {
        playIncomingChatBeep();
      }
    };
    channel.bind("message:new", handler);

    return () => {
      channel.unbind("message:new", handler);
      pusherClient.unsubscribe(selectedTracking);
    };
  }, [selectedTracking]);

  const instance: Instance | undefined = whatsappInstance
    ? {
        token: whatsappInstance.apiKey ?? "",
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

    const params = new URLSearchParams(searchParams.toString());
    params.set("trackingId", id);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <>
      <aside className="pb-20 lg:pb-0 lg:flex w-full px-5 flex flex-col h-full overflow-hidden">
        {/* ── Header DESKTOP (lg+): mantém UX original "Tracking Chat" ── */}
        <div className="hidden lg:flex justify-between mb-4 pt-4 shrink-0">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="size-4" />
            <div className="text-lg font-medium">Tracking Chat</div>
          </div>
          <div className="flex items-center">
            {!noInstance && !instanceDisconnected && !isLoadingTrackings && (
              <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
                <UserRoundPlusIcon className="size-4" />
              </Button>
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

        {/* ── Header MOBILE: WhatsApp-style ───────────────────────────
            - Esquerda: SidebarTrigger + menu "..." (filtros status flow)
            - Direita: phone (em breve) + "+" (novo lead)
            - Título grande "Conversas" em linha separada abaixo. */}
        <div className="lg:hidden flex justify-between items-center pt-4 mb-2 shrink-0">
          <div className="flex items-center gap-1">
            <SidebarTrigger className="size-4" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full"
                  aria-label="Mais filtros"
                >
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Filtros de status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={statusFlowFilter === "ACTIVE"}
                  onCheckedChange={(checked) =>
                    setStatusFlowFilter(checked ? "ACTIVE" : null)
                  }
                >
                  <CircleDashedIcon className="size-3.5" /> Em atendimento
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={statusFlowFilter === "FINISHED"}
                  onCheckedChange={(checked) =>
                    setStatusFlowFilter(checked ? "FINISHED" : null)
                  }
                >
                  <CheckCircle2Icon className="size-3.5" /> Finalizados
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={favoritesOnly}
                  onCheckedChange={(checked) => setFavoritesOnly(!!checked)}
                >
                  Só favoritas
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={archivedOnly}
                  onCheckedChange={(checked) => setArchivedOnly(!!checked)}
                >
                  Arquivados
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              onClick={() =>
                toast.info("Em breve — ligações dentro do NASA Chat", {
                  position: "bottom-right",
                })
              }
              aria-label="Ligar (em breve)"
            >
              <PhoneIcon className="size-4" />
            </Button>
            {!noInstance && !instanceDisconnected && !isLoadingTrackings && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                onClick={() => setOpen(true)}
                aria-label="Novo lead"
              >
                <UserRoundPlusIcon className="size-4" />
              </Button>
            )}
          </div>
        </div>
        <h1 className="lg:hidden text-2xl font-bold tracking-tight shrink-0 mb-3">
          Conversas
        </h1>

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
          {/* DESKTOP (lg+): mantém row de channel circles + filter pills.
              MOBILE (default): esses filtros vão pro bottom bar +
              dropdown "..." do header — vide blocos `lg:hidden` acima
              e `<TrackingChatBottomTabs>` abaixo. */}
          <div className="hidden lg:block">
            <ConversationFilters
              trackingId={selectedTracking || null}
              selectedChannel={selectedChannel}
              onChannelChange={setSelectedChannel}
              statusFlowFilter={statusFlowFilter}
              onStatusFlowFilterChange={setStatusFlowFilter}
              favoritesOnly={favoritesOnly}
              onFavoritesOnlyChange={setFavoritesOnly}
              archivedOnly={archivedOnly}
              onArchivedOnlyChange={setArchivedOnly}
              selectedTagIds={selectedTagIds}
              onSelectedTagIdsChange={setSelectedTagIds}
            />
          </div>

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
                      Nenhuma conversa encontrada. Você pode adicionar
                      manualmente ou importar do seu WhatsApp conectado.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <div className="flex flex-col gap-2">
                      <Button variant="default" onClick={() => setOpen(true)}>
                        Adicionar conversa
                      </Button>
                      {/* Importação direta da uazapi — só faz sentido se
                          a instância está conectada. Esconde o botão se
                          tracking não tem instância ou está desconectada. */}
                      {selectedTracking &&
                        !noInstance &&
                        !instanceDisconnected && (
                          <ImportFromWhatsAppButton
                            trackingId={selectedTracking}
                          />
                        )}
                    </div>
                  </EmptyContent>
                </Empty>
              )}
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="overflow-y-auto flex flex-col gap-2 flex-1 pb-4 scroll-cols-tracking min-h-0"
              >
                {orderedItems.map((item) => (
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
        {/* Bottom tab bar flutuante — APENAS MOBILE (`lg:hidden`).
            Substitui channel circles + pills que em desktop ocupam o
            espaço normal. 5 ações principais (Settings / Conversas /
            Informações / Canal / Tags) sem comer espaço da lista. */}
        <div className="lg:hidden">
          <TrackingChatBottomTabs
            trackingId={selectedTracking || null}
            selectedChannel={selectedChannel}
            onChannelChange={setSelectedChannel}
            selectedTagIds={selectedTagIds}
            onSelectedTagIdsChange={setSelectedTagIds}
            settingsHref={pageSettings}
          />
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

