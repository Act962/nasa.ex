import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Message,
  InfiniteMessages,
  MessageStatus,
  MarkedMessage,
} from "../types";
import { toast } from "sonner";
import dayjs from "dayjs";

interface UseMutationTextMessageProps {
  conversationId: string;
  id?: string;
  lead: {
    id: string;
    name: string;
    phone: string | null;
  };
  messageSelected?: MarkedMessage;
}

const updateCacheWithOptimisticMessage = (
  old: any,
  optimisticMessage: Message,
) => {
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

  const firstPage = old.pages[0] ?? {
    items: [],
    nextCursor: undefined,
  };
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

const updateCacheMessageStatus = (
  old: InfiniteMessages | undefined,
  tempId: string,
  updatedMessage: Message,
) => {
  if (!old) return old;

  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      items: page.items.map((group) => ({
        ...group,
        messages: group.messages.map((m) =>
          m.id === tempId
            ? { ...updatedMessage, status: MessageStatus.SEEN }
            : m,
        ),
      })),
    })),
  } as InfiniteMessages;
};

export function useMutationTextMessage({
  conversationId,
  lead,
  messageSelected,
}: UseMutationTextMessageProps) {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.message.create.mutationOptions({
      onMutate: async (data) => {
        await queryClient.cancelQueries({
          queryKey: ["message.list", conversationId],
        });
        const previousData = queryClient.getQueryData<InfiniteMessages>([
          "message.list",
          conversationId,
        ]);

        const tempId = `optimistic-${crypto.randomUUID()}`;

        const optimisticMessage: Message = {
          id: tempId,
          messageId: tempId,
          body: data.body,
          quotedMessageId: data.replyId ?? undefined,
          createdAt: new Date(),
          status: MessageStatus.SENT,
          fromMe: true,
          mediaUrl: data.mediaUrl ?? null,
          conversation: {
            lead: {
              id: lead.id,
              name: lead.name,
            },
          },
          quotedMessage: messageSelected
            ? {
                ...messageSelected,
                mediaUrl: messageSelected.mediaUrl || null,
                mimetype: messageSelected.mimetype || null,
                fileName: messageSelected.fileName || null,
                createdAt: new Date(),
                status: MessageStatus.SENT,
                conversation: {
                  lead: {
                    id: messageSelected.lead.id,
                    name: messageSelected.lead.name,
                  },
                },
              }
            : null,
        };

        queryClient.setQueryData(["message.list", conversationId], (old: any) =>
          updateCacheWithOptimisticMessage(old, optimisticMessage),
        );

        return {
          previousData,
          tempId,
        };
      },
      onSuccess: (data, _variables, context) => {
        queryClient.setQueryData<InfiniteMessages>(
          ["message.list", conversationId],
          (old) =>
            updateCacheMessageStatus(
              old,
              context?.tempId,
              data.message as Message,
            ),
        );
      },
      onError(_err, _variables, context) {
        if (context?.previousData) {
          queryClient.setQueryData(
            ["message.list", conversationId],
            context.previousData,
          );
        }
        return toast.error("Erro ao enviar mensagem");
      },
    }),
  );
}

interface UseMutationMediaMessageProps {
  conversationId: string;
  lead: {
    id: string;
    name: string;
    phone: string | null;
  };
  quotedMessageId?: string | null;
  messageSelected?: MarkedMessage;
}

export function useMutationImageMessage({
  conversationId,
  lead,
  quotedMessageId,
  messageSelected,
}: UseMutationMediaMessageProps) {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.message.createWithImage.mutationOptions({
      onMutate: async (data) => {
        await queryClient.cancelQueries({
          queryKey: ["message.list", conversationId],
        });
        const previousData = queryClient.getQueryData<InfiniteMessages>([
          "message.list",
          conversationId,
        ]);

        const tempId = `optimistic-${crypto.randomUUID()}`;

        const optimisticMessage: Message = {
          id: tempId,
          messageId: tempId,
          body: data.body ?? null,
          quotedMessageId: quotedMessageId ?? undefined,
          createdAt: new Date(),
          fromMe: true,
          mediaUrl: data.mediaUrl ?? null,
          mimetype: "image/jpeg",
          status: MessageStatus.SENT,
          conversation: {
            lead: {
              id: lead.id,
              name: lead.name,
            },
          },
          quotedMessage: messageSelected
            ? {
                id: messageSelected.id,
                messageId: messageSelected.messageId,
                body: messageSelected.body,
                fromMe: messageSelected.fromMe,
                mediaUrl: messageSelected.mediaUrl || null,
                mimetype: messageSelected.mimetype || null,
                fileName: messageSelected.fileName || null,
                createdAt: new Date(),
                status: MessageStatus.SENT,
                conversation: {
                  lead: {
                    id: messageSelected.lead.id,
                    name: messageSelected.lead.name,
                  },
                },
              }
            : null,
        };

        queryClient.setQueryData(["message.list", conversationId], (old: any) =>
          updateCacheWithOptimisticMessage(old, optimisticMessage),
        );

        return {
          previousData,
          tempId,
        };
      },
      onSuccess: (data, _variables, context) => {
        queryClient.setQueryData<InfiniteMessages>(
          ["message.list", conversationId],
          (old) =>
            updateCacheMessageStatus(
              old,
              context?.tempId,
              data.message as Message,
            ),
        );
      },
      onError(_err, _variables, context) {
        if (context?.previousData) {
          queryClient.setQueryData(
            ["message.list", conversationId],
            context.previousData,
          );
        }
        return toast.error("Erro ao enviar mensagem");
      },
    }),
  );
}

export function useMutationFileMessage({
  conversationId,
  lead,
  quotedMessageId,
  messageSelected,
}: UseMutationMediaMessageProps) {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.message.createWithFile.mutationOptions({
      onMutate: async (data) => {
        await queryClient.cancelQueries({
          queryKey: ["message.list", conversationId],
        });
        const previousData = queryClient.getQueryData<InfiniteMessages>([
          "message.list",
          conversationId,
        ]);

        const tempId = `optimistic-${crypto.randomUUID()}`;

        const optimisticMessage: Message = {
          id: tempId,
          messageId: tempId,
          body: data.body ?? null,
          quotedMessageId: quotedMessageId ?? undefined,
          createdAt: new Date(),
          fromMe: true,
          mediaUrl: data.mediaUrl ?? null,
          mimetype: data.mimetype,
          fileName: data.fileName,
          status: MessageStatus.SENT,
          conversation: {
            lead: {
              id: lead.id,
              name: lead.name,
            },
          },
          quotedMessage: messageSelected
            ? {
                ...messageSelected,
                mediaUrl: messageSelected.mediaUrl || null,
                mimetype: messageSelected.mimetype || null,
                fileName: messageSelected.fileName || null,
                createdAt: new Date(),
                status: MessageStatus.SENT,
                conversation: {
                  lead: {
                    id: messageSelected.lead.id,
                    name: messageSelected.lead.name,
                  },
                },
              }
            : null,
        };

        queryClient.setQueryData(["message.list", conversationId], (old: any) =>
          updateCacheWithOptimisticMessage(old, optimisticMessage),
        );

        return {
          previousData,
          tempId,
        };
      },
      onSuccess: (data, _variables, context) => {
        queryClient.setQueryData<InfiniteMessages>(
          ["message.list", conversationId],
          (old) =>
            updateCacheMessageStatus(
              old,
              context?.tempId,
              data.message as Message,
            ),
        );
      },
      onError(_err, _variables, context) {
        if (context?.previousData) {
          queryClient.setQueryData(
            ["message.list", conversationId],
            context.previousData,
          );
        }
        return toast.error("Erro ao enviar mensagem");
      },
    }),
  );
}

export function useMutationAudioMessage({
  conversationId,
  lead,
  quotedMessageId,
  messageSelected,
}: UseMutationMediaMessageProps) {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.message.createAudio.mutationOptions({
      onMutate: async (data) => {
        await queryClient.cancelQueries({
          queryKey: ["message.list", conversationId],
        });
        const previousData = queryClient.getQueryData<InfiniteMessages>([
          "message.list",
          conversationId,
        ]);

        const tempId = `optimistic-${crypto.randomUUID()}`;

        const optimisticMessage: Message = {
          id: tempId,
          messageId: tempId,
          body: null,
          quotedMessageId: quotedMessageId ?? undefined,
          createdAt: new Date(),
          fromMe: true,
          mediaUrl: URL.createObjectURL(data.blob),
          mimetype: data.mimetype,
          fileName: tempId + ".mp3",
          status: MessageStatus.SENT,
          conversation: {
            lead: {
              id: lead.id,
              name: lead.name,
            },
          },
          quotedMessage: messageSelected
            ? {
                ...messageSelected,
                mediaUrl: messageSelected.mediaUrl || null,
                mimetype: messageSelected.mimetype || null,
                fileName: messageSelected.fileName || null,
                createdAt: new Date(),
                status: MessageStatus.SENT,
                conversation: {
                  lead: {
                    id: messageSelected.lead.id,
                    name: messageSelected.lead.name,
                  },
                },
              }
            : null,
        };

        queryClient.setQueryData(["message.list", conversationId], (old: any) =>
          updateCacheWithOptimisticMessage(old, optimisticMessage),
        );

        return {
          previousData,
          tempId,
        };
      },
      onSuccess: (data, _variables, context) => {
        queryClient.setQueryData<InfiniteMessages>(
          ["message.list", conversationId],
          (old) =>
            updateCacheMessageStatus(old, context?.tempId, {
              ...data.message,
              quotedMessageId: data.message.quotedMessageId ?? undefined,
            } as Message),
        );
      },
      onError(_err, _variables, context) {
        if (context?.previousData) {
          queryClient.setQueryData(
            ["message.list", conversationId],
            context.previousData,
          );
        }
        return toast.error("Erro ao enviar mensagem");
      },
    }),
  );
}

export function useMutationDeleteMessage({
  conversationId,
}: {
  conversationId: string;
}) {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.message.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["message.list", conversationId],
        });
        toast.success("Mensagem deletada");
      },
    }),
  );
}

const updateCacheEditedMessage = (
  old: InfiniteMessages | undefined,
  messageId: string,
  newBody: string,
) => {
  if (!old) return old;

  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      items: page.items.map((group) => ({
        ...group,
        messages: group.messages.map((m) =>
          m.messageId === messageId
            ? { ...m, body: newBody, status: MessageStatus.SENT }
            : m,
        ),
      })),
    })),
  } as InfiniteMessages;
};

const updateCacheMessageID = (
  old: InfiniteMessages | undefined,
  oldMessageId: string,
  newMessageId: string,
) => {
  if (!old) return old;

  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      items: page.items.map((group) => ({
        ...group,
        messages: group.messages.map((m) =>
          m.messageId === oldMessageId ? { ...m, messageId: newMessageId } : m,
        ),
      })),
    })),
  } as InfiniteMessages;
};

export function useMutationEditMessage({
  conversationId,
}: {
  conversationId: string;
}) {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.message.edit.mutationOptions({
      onMutate: async (data) => {
        await queryClient.cancelQueries({
          queryKey: ["message.list", conversationId],
        });

        const previousData = queryClient.getQueryData<InfiniteMessages>([
          "message.list",
          conversationId,
        ]);

        queryClient.setQueryData<InfiniteMessages>(
          ["message.list", conversationId],
          (old) => updateCacheEditedMessage(old, data.id, data.text),
        );

        return { previousData };
      },
      onSuccess: (data, variables) => {
        queryClient.setQueryData<InfiniteMessages>(
          ["message.list", conversationId],
          (old) => updateCacheMessageID(old, variables.id, data.messageid),
        );
        toast.success("Mensagem editada");
      },
      onError: (_err, _variables, context) => {
        if (context?.previousData) {
          queryClient.setQueryData(
            ["message.list", conversationId],
            context.previousData,
          );
        }
        toast.error("Erro ao editar mensagem");
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: ["message.list", conversationId],
        });
      },
    }),
  );
}
export function useMutationMarkReadMessage() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.message.markRead.mutationOptions({
      onSuccess: (_, variables) => {
        // Optimistically update the unreadCount in all conversation list queries
        queryClient.setQueriesData(
          { queryKey: ["conversations.list"] },
          (old: any) => {
            if (!old) return old;

            return {
              ...old,
              pages: old.pages.map((page: any) => ({
                ...page,
                items: page.items.map((item: any) =>
                  item.id === variables.conversationId
                    ? { ...item, unreadCount: 0 }
                    : item,
                ),
              })),
            };
          },
        );

        // Also invalidate to be safe and ensure other data is synced
        queryClient.invalidateQueries({
          queryKey: ["conversations.list"],
        });
      },
    }),
  );
}
