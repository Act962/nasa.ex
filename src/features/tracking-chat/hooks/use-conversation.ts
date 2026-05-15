import { orpc } from "@/lib/orpc";
import { pusherClient } from "@/lib/pusher";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { conversationProps, InfiniteConversations } from "../types";
import { toast } from "sonner";
import {
  playSoundNotification,
  useSoundNotificationSettings,
} from "@/features/tracking-settings/hooks/use-sound-notification";

export function useInfinityConversation(
  trackingId: string,
  statusId: string | null,
  search: string | null,
  currentConversationId?: string,
  statusFlowFilter?: "FINISHED" | "ACTIVE" | null,
  selectedChannel?: string,
  selectedTagIds?: string[],
  favoritesOnly?: boolean,
) {
  const queryClient = useQueryClient();
  const reopenLead = useMutation(orpc.leads.update.mutationOptions({}));
  const { settings } = useSoundNotificationSettings(trackingId);

  useEffect(() => {
    if (!trackingId) return;

    const queryKey = [
      "conversations.list",
      trackingId,
      statusId,
      search,
      statusFlowFilter ?? null,
      selectedChannel ?? "ALL",
      selectedTagIds ?? [],
      favoritesOnly ?? false,
    ];

    const conversationHandler = (body: conversationProps) => {
      playSoundNotification(settings);

      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;

        const exists = old.pages.some((page: any) =>
          page.items.some((item: any) => item.id === body.id),
        );

        if (exists) return old;

        const updatedPages = [...old.pages];
        updatedPages[0] = {
          ...updatedPages[0],
          items: [body, ...updatedPages[0].items],
        };

        return {
          ...old,
          pages: updatedPages,
        };
      });
    };

    const messageHandler = (message: any) => {
      let found = false;
      let reopenLeadId: string | null = null;
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;

        let conversationToMove: any = null;

        const newPages = old.pages.map((page: any) => {
          const newItems = page.items.filter((item: any) => {
            if (item.id === message.conversationId) {
              const shouldReopen = item?.lead?.statusFlow === "FINISHED";

              if (shouldReopen) {
                reopenLeadId = item.leadId ?? item?.lead?.id ?? null;
              }

              conversationToMove = {
                ...item,
                lastMessage: message,
                lastMessageAt: message.createdAt,
                lead: shouldReopen
                  ? {
                      ...item.lead,
                      statusFlow: "ACTIVE",
                    }
                  : item.lead,
                unreadCount:
                  message.conversationId === currentConversationId
                    ? 0
                    : !message.fromMe
                      ? (item.unreadCount || 0) + 1
                      : item.unreadCount,
              };
              found = true;
              return false;
            }
            return true;
          });
          return { ...page, items: newItems };
        });

        if (conversationToMove) {
          newPages[0].items = [conversationToMove, ...newPages[0].items];
        }

        return {
          ...old,
          pages: newPages,
        };
      });

      if (!found) {
        queryClient.invalidateQueries({ queryKey });
      }

      // Se a conversa estava finalizada e o lead voltou a falar,
      // reabra o lead no backend para ele sair de "Finalizados".
      if (reopenLeadId) {
        reopenLead.mutate({ id: reopenLeadId, statusFlow: "ACTIVE" } as any);
        queryClient.invalidateQueries({ queryKey: ["conversations.list"] });
      }
    };

    const leadUpdatedHandler = () => {
      queryClient.invalidateQueries({ queryKey });
    };

    pusherClient.bind("conversation:new", conversationHandler);
    pusherClient.bind("message:new", messageHandler);
    pusherClient.bind("lead:updated", leadUpdatedHandler);

    return () => {
      pusherClient.unbind("conversation:new", conversationHandler);
      pusherClient.unbind("message:new", messageHandler);
      pusherClient.unbind("lead:updated", leadUpdatedHandler);
    };
  }, [
    trackingId,
    statusId,
    search,
    statusFlowFilter,
    selectedChannel,
    selectedTagIds,
    favoritesOnly,
    queryClient,
    currentConversationId,
    reopenLead,
  ]);
}

/**
 * Hook utilitário de listagem de conversas com infinite scroll.
 * Segue exatamente o mesmo padrão do ConversationsList.
 * Usado exclusivamente no ForwardMessageDialog.
 */
export function useConversationListInfinite({
  trackingId,
  search = "",
  enabled = true,
}: {
  trackingId: string;
  search?: string;
  enabled?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const infiniteOptions = orpc.conversation.list.infiniteOptions({
    input: (pageParam: string | undefined) => ({
      trackingId,
      search,
      cursor: pageParam,
      limit: 30,
      statusId: null,
    }),
    queryKey: ["conversations.list.forward", trackingId, search],
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      ...infiniteOptions,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      enabled: enabled && !!trackingId,
    });

  const items = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  const isNearBottom = (el: HTMLDivElement) =>
    el.scrollHeight - el.scrollTop - el.clientHeight <= 80;

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    if (isNearBottom(el)) fetchNextPage();
  };

  return { items, isLoading, isFetchingNextPage, scrollRef, handleScroll };
}

export function useCreateConversation({ trackingId }: { trackingId: string }) {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.conversation.create.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.message);
        if (data.contactsInvalids && data.contactsInvalids.length > 0) {
          toast.error(
            `Os seguintes contatos não estão no whatsapp: ${data.contactsInvalids.join(
              ", ",
            )}`,
          );
        }
        queryClient.invalidateQueries({
          queryKey: ["conversations.list", trackingId],
        });
        queryClient.invalidateQueries({
          queryKey: orpc.leads.get.queryKey({
            input: {
              id:
                data.leadIds && data.leadIds?.length > 0 ? data.leadIds[0] : "",
            },
          }),
        });
      },
      onError: (error) => {
        toast.error("Erro ao criar conversa!");
        console.error(error);
      },
    }),
  );
}

export function