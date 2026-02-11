import { orpc } from "@/lib/orpc";
import { pusherClient } from "@/lib/pusher";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { conversationProps, InfiniteConversations } from "../types";
import { toast } from "sonner";

export function useQueryConversation(trackingId: string) {
  const { data, isLoading } = useQuery(
    orpc.conversation.list.queryOptions({
      input: {
        trackingId,
      },
    }),
  );

  return {
    data,
    isLoading,
  };
}

export function useInfinityConversation(trackingId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!trackingId) return;

    const queryKey = ["conversations.list", trackingId];

    const conversationHandler = (body: conversationProps) => {
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
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;

        let conversationToMove: any = null;

        const newPages = old.pages.map((page: any) => {
          const newItems = page.items.filter((item: any) => {
            if (item.id === message.conversationId) {
              conversationToMove = {
                ...item,
                lastMessage: message,
                lastMessageAt: message.createdAt,
              };
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
    };

    pusherClient.bind("conversation:new", conversationHandler);
    pusherClient.bind("message:new", messageHandler);

    return () => {
      pusherClient.unbind("conversation:new", conversationHandler);
      pusherClient.unbind("message:new", messageHandler);
    };
  }, [trackingId, queryClient]);
}

export function useCreateConversation({ trackingId }: { trackingId: string }) {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.conversation.create.mutationOptions({
      onSuccess: () => {
        toast.success("Conversa criada com sucesso!");
        queryClient.invalidateQueries({
          queryKey: orpc.conversation.list.queryKey({
            input: { trackingId },
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
