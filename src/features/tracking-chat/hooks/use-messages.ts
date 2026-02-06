import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Message, InfiniteMessages, MessageStatus } from "../types";
import { toast } from "sonner";

interface UseMutationTextMessageProps {
  conversationId: string;
  id?: string;
  lead: {
    id: string;
    name: string;
    phone: string | null;
  };
}

export function useMutationTextMessage({
  conversationId,
  lead,
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
        };
        queryClient.setQueryData(
          ["message.list", conversationId],
          (old: any) => {
            if (!old) {
              return {
                pages: [
                  {
                    items: [optimisticMessage],
                    nextCursor: undefined,
                  },
                ],
                pageParams: [undefined],
              } satisfies InfiniteMessages;
            }
            const firstPage = old.pages[0] ?? {
              items: [],
              nextCursor: undefined,
            };
            const updatedFirstPage = {
              ...firstPage,
              items: [optimisticMessage, ...firstPage.items],
            };
            return {
              ...old,
              pages: [updatedFirstPage, ...old.pages.slice(1)],
            };
          },
        );
        return {
          previousData,
          tempId,
        };
      },
      onSuccess: (data, _varibalies, context) => {
        queryClient.setQueryData<InfiniteMessages>(
          ["message.list", conversationId],
          (old) => {
            if (!old) return old;

            const updatePages = old.pages.map((page) => ({
              ...page,
              items: page.items.map((message) =>
                message.id === context?.tempId
                  ? {
                      ...data.message,
                      status: MessageStatus.SEEN,
                      quotedMessageId:
                        data.message.quotedMessageId ?? undefined,
                    }
                  : message,
              ),
            }));
            return { ...old, pages: updatePages };
          },
        );
      },
      onError(_err, _varibalies, context) {
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
}

export function useMutationImageMessage({
  conversationId,
  lead,
  quotedMessageId,
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
        };
        queryClient.setQueryData(
          ["message.list", conversationId],
          (old: any) => {
            if (!old) {
              return {
                pages: [
                  {
                    items: [optimisticMessage],
                    nextCursor: undefined,
                  },
                ],
                pageParams: [undefined],
              } satisfies InfiniteMessages;
            }
            const firstPage = old.pages[0] ?? {
              items: [],
              nextCursor: undefined,
            };
            const updatedFirstPage = {
              ...firstPage,
              items: [optimisticMessage, ...firstPage.items],
            };
            return {
              ...old,
              pages: [updatedFirstPage, ...old.pages.slice(1)],
            };
          },
        );
        return {
          previousData,
          tempId,
        };
      },
      onSuccess: (data, _varibalies, context) => {
        queryClient.setQueryData<InfiniteMessages>(
          ["message.list", conversationId],
          (old) => {
            if (!old) return old;

            const updatePages = old.pages.map((page) => ({
              ...page,
              items: page.items.map((message) =>
                message.id === context?.tempId
                  ? {
                      ...data.message,
                      status: MessageStatus.SEEN,
                      quotedMessageId:
                        data.message.quotedMessageId ?? undefined,
                    }
                  : message,
              ),
            }));
            return { ...old, pages: updatePages };
          },
        );
      },
      onError(_err, _varibalies, context) {
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
        };
        queryClient.setQueryData(
          ["message.list", conversationId],
          (old: any) => {
            if (!old) {
              return {
                pages: [
                  {
                    items: [optimisticMessage],
                    nextCursor: undefined,
                  },
                ],
                pageParams: [undefined],
              } satisfies InfiniteMessages;
            }
            const firstPage = old.pages[0] ?? {
              items: [],
              nextCursor: undefined,
            };
            const updatedFirstPage = {
              ...firstPage,
              items: [optimisticMessage, ...firstPage.items],
            };
            return {
              ...old,
              pages: [updatedFirstPage, ...old.pages.slice(1)],
            };
          },
        );
        return {
          previousData,
          tempId,
        };
      },
      onSuccess: (data, _varibalies, context) => {
        queryClient.setQueryData<InfiniteMessages>(
          ["message.list", conversationId],
          (old) => {
            if (!old) return old;

            const updatePages = old.pages.map((page) => ({
              ...page,
              items: page.items.map((message) =>
                message.id === context?.tempId
                  ? {
                      ...data.message,
                      status: MessageStatus.SEEN,
                      quotedMessageId:
                        data.message.quotedMessageId ?? undefined,
                    }
                  : message,
              ),
            }));
            return { ...old, pages: updatePages };
          },
        );
      },
      onError(_err, _varibalies, context) {
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
        };
        queryClient.setQueryData(
          ["message.list", conversationId],
          (old: any) => {
            if (!old) {
              return {
                pages: [
                  {
                    items: [optimisticMessage],
                    nextCursor: undefined,
                  },
                ],
                pageParams: [undefined],
              } satisfies InfiniteMessages;
            }
            const firstPage = old.pages[0] ?? {
              items: [],
              nextCursor: undefined,
            };
            const updatedFirstPage = {
              ...firstPage,
              items: [optimisticMessage, ...firstPage.items],
            };
            return {
              ...old,
              pages: [updatedFirstPage, ...old.pages.slice(1)],
            };
          },
        );
        return {
          previousData,
          tempId,
        };
      },
      onSuccess: (data, _varibalies, context) => {
        queryClient.setQueryData<InfiniteMessages>(
          ["message.list", conversationId],
          (old) => {
            if (!old) return old;

            const updatePages = old.pages.map((page) => ({
              ...page,
              items: page.items.map((message) =>
                message.id === context?.tempId
                  ? {
                      ...data.message,
                      status: MessageStatus.SEEN,
                      quotedMessageId:
                        data.message.quotedMessageId ?? undefined,
                    }
                  : message,
              ),
            }));
            return { ...old, pages: updatePages };
          },
        );
      },
      onError(_err, _varibalies, context) {
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
