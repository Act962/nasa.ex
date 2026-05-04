"use client";

import { orpc } from "@/lib/orpc";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import dayjs from "dayjs";
import { toast } from "sonner";
import {
  ActionChatMessage,
  InfiniteActionChatMessages,
  MarkedActionChatMessage,
} from "../components/chat/types";

export function useListActionChatMessages(actionId: string) {
  const infiniteOptions = orpc.action.chat.list.infiniteOptions({
    input: (pageParam: string | undefined) => ({
      actionId,
      cursor: pageParam,
      limit: 30,
    }),
    queryKey: ["action.chat.list", actionId],
    initialPageParam: undefined,
    getNextPageParam: (lastPage: { nextCursor?: string }) => lastPage.nextCursor,
  });

  return useInfiniteQuery({
    ...infiniteOptions,
    enabled: !!actionId,
    refetchOnWindowFocus: false,
  });
}

const updateCacheWithOptimisticMessage = (
  old: any,
  optimisticMessage: ActionChatMessage,
): any => {
  const today = dayjs().format("YYYY-MM-DD");

  if (!old) {
    return {
      pages: [
        {
          items: [{ date: today, messages: [optimisticMessage] }],
          nextCursor: undefined,
        },
      ],
      pageParams: [undefined],
    };
  }

  const firstPage = old.pages[0] ?? { items: [], nextCursor: undefined };
  const firstGroup = firstPage.items[0];

  if (firstGroup && firstGroup.date === today) {
    const updatedFirstPage = {
      ...firstPage,
      items: [
        {
          ...firstGroup,
          messages: [optimisticMessage, ...firstGroup.messages],
        },
        ...firstPage.items.slice(1),
      ],
    };
    return {
      ...old,
      pages: [updatedFirstPage, ...old.pages.slice(1)],
    };
  }

  const updatedFirstPage = {
    ...firstPage,
    items: [{ date: today, messages: [optimisticMessage] }, ...firstPage.items],
  };
  return {
    ...old,
    pages: [updatedFirstPage, ...old.pages.slice(1)],
  };
};

const replaceOptimisticMessage = (
  old: InfiniteActionChatMessages | undefined,
  tempId: string,
  newMessage: ActionChatMessage,
): InfiniteActionChatMessages | undefined => {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map((page: any) => ({
      ...page,
      items: page.items.map((group: any) => ({
        ...group,
        messages: group.messages.map((m: ActionChatMessage) =>
          m.id === tempId ? newMessage : m,
        ),
      })),
    })),
  };
};

interface MutationProps {
  actionId: string;
  messageSelected?: MarkedActionChatMessage;
}

export function useMutationActionChatTextMessage({
  actionId,
  messageSelected,
}: MutationProps) {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();

  return useMutation(
    orpc.action.chat.create.mutationOptions({
      onMutate: async (data: { body: string; quotedMessageId?: string }) => {
        await queryClient.cancelQueries({
          queryKey: ["action.chat.list", actionId],
        });
        const previousData =
          queryClient.getQueryData<InfiniteActionChatMessages>([
            "action.chat.list",
            actionId,
          ]);

        const tempId = `optimistic-${crypto.randomUUID()}`;
        const optimistic: ActionChatMessage = {
          id: tempId,
          actionId,
          body: data.body,
          mediaUrl: null,
          mediaType: null,
          mimetype: null,
          fileName: null,
          quotedMessageId: data.quotedMessageId ?? null,
          senderId: session?.user.id ?? "",
          senderName: session?.user.name ?? null,
          sender: {
            id: session?.user.id ?? "",
            name: session?.user.name ?? null,
            image: session?.user.image ?? null,
          },
          isEdited: false,
          isDeleted: false,
          createdAt: new Date(),
          quotedMessage: messageSelected
            ? {
                id: messageSelected.id,
                body: messageSelected.body,
                mediaUrl: messageSelected.mediaUrl ?? null,
                mediaType: messageSelected.mediaType ?? null,
                mimetype: messageSelected.mimetype ?? null,
                fileName: messageSelected.fileName ?? null,
                senderId: messageSelected.senderId,
                senderName: messageSelected.senderName ?? null,
                isDeleted: false,
                createdAt: messageSelected.createdAt ?? new Date(),
              }
            : null,
        };

        queryClient.setQueryData(["action.chat.list", actionId], (old: any) =>
          updateCacheWithOptimisticMessage(old, optimistic),
        );

        return { previousData, tempId };
      },
      onSuccess: (data: { message: ActionChatMessage }, _vars, context) => {
        queryClient.setQueryData<InfiniteActionChatMessages>(
          ["action.chat.list", actionId],
          (old) =>
            replaceOptimisticMessage(old, (context as any)!.tempId, data.message),
        );
      },
      onError: (_err, _vars, context) => {
        const ctx = context as { previousData?: InfiniteActionChatMessages } | undefined;
        if (ctx?.previousData) {
          queryClient.setQueryData(
            ["action.chat.list", actionId],
            ctx.previousData,
          );
        }
        toast.error("Erro ao enviar mensagem");
      },
    }),
  );
}

export function useMutationActionChatFileMessage({
  actionId,
  messageSelected,
}: MutationProps) {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();

  return useMutation(
    orpc.action.chat.createWithFile.mutationOptions({
      onMutate: async (data: {
        mediaUrl: string;
        mediaType: "image" | "file" | "audio";
        fileName?: string;
        mimetype?: string;
        body?: string;
        quotedMessageId?: string;
      }) => {
        await queryClient.cancelQueries({
          queryKey: ["action.chat.list", actionId],
        });
        const previousData =
          queryClient.getQueryData<InfiniteActionChatMessages>([
            "action.chat.list",
            actionId,
          ]);

        const tempId = `optimistic-${crypto.randomUUID()}`;
        const optimistic: ActionChatMessage = {
          id: tempId,
          actionId,
          body: data.body ?? null,
          mediaUrl: data.mediaUrl,
          mediaType: data.mediaType,
          mimetype: data.mimetype ?? null,
          fileName: data.fileName ?? null,
          quotedMessageId: data.quotedMessageId ?? null,
          senderId: session?.user.id ?? "",
          senderName: session?.user.name ?? null,
          sender: {
            id: session?.user.id ?? "",
            name: session?.user.name ?? null,
            image: session?.user.image ?? null,
          },
          isEdited: false,
          isDeleted: false,
          createdAt: new Date(),
          quotedMessage: messageSelected
            ? {
                id: messageSelected.id,
                body: messageSelected.body,
                mediaUrl: messageSelected.mediaUrl ?? null,
                mediaType: messageSelected.mediaType ?? null,
                mimetype: messageSelected.mimetype ?? null,
                fileName: messageSelected.fileName ?? null,
                senderId: messageSelected.senderId,
                senderName: messageSelected.senderName ?? null,
                isDeleted: false,
                createdAt: messageSelected.createdAt ?? new Date(),
              }
            : null,
        };

        queryClient.setQueryData(["action.chat.list", actionId], (old: any) =>
          updateCacheWithOptimisticMessage(old, optimistic),
        );

        return { previousData, tempId };
      },
      onSuccess: (data: { message: ActionChatMessage }, _vars, context) => {
        queryClient.setQueryData<InfiniteActionChatMessages>(
          ["action.chat.list", actionId],
          (old) =>
            replaceOptimisticMessage(old, (context as any)!.tempId, data.message),
        );
      },
      onError: (_err, _vars, context) => {
        const ctx = context as { previousData?: InfiniteActionChatMessages } | undefined;
        if (ctx?.previousData) {
          queryClient.setQueryData(
            ["action.chat.list", actionId],
            ctx.previousData,
          );
        }
        toast.error("Erro ao enviar mídia");
      },
    }),
  );
}

export function useMutationActionChatEditMessage({ actionId }: { actionId: string }) {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.action.chat.edit.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["action.chat.list", actionId],
        });
        toast.success("Mensagem editada");
      },
      onError: () => {
        toast.error("Erro ao editar mensagem");
      },
    }),
  );
}

export function useMutationActionChatDeleteMessage({
  actionId,
}: {
  actionId: string;
}) {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.action.chat.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["action.chat.list", actionId],
        });
        toast.success("Mensagem apagada");
      },
      onError: () => toast.error("Erro ao apagar mensagem"),
    }),
  );
}

export function useMutationActionChatMarkRead({ actionId: _actionId }: { actionId: string }) {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.action.chat.markRead.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["action.chat.unreadCounts"],
        });
      },
    }),
  );
}

export function useActionChatUnreadCounts(actionIds: string[]) {
  const sortedKey = [...actionIds].sort().join(",");
  return useQuery({
    ...orpc.action.chat.unreadCounts.queryOptions({
      input: { actionIds },
    }),
    queryKey: ["action.chat.unreadCounts", sortedKey],
    refetchInterval: 30_000,
    enabled: actionIds.length > 0,
  });
}
