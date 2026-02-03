import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Message, InfiniteMessages } from "../types";
import { toast } from "sonner";

export function useMutationTextMessage(
  conversationId: string,
  lead: {
    id: string;
    name: string;
    phone: string | null;
  },
) {
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
          body: data.body,
          createdAt: new Date(),
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

export function useMutationImageMessage(
  conversationId: string,
  lead: {
    id: string;
    name: string;
    phone: string | null;
  },
) {
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
          body: data.body ?? null,
          createdAt: new Date(),
          fromMe: true,
          mediaUrl: data.mediaUrl ?? null,
          mimetype: "image/jpeg",
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

export function useMutationFileMessage(
  conversationId: string,
  lead: {
    id: string;
    name: string;
    phone: string | null;
  },
) {
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
          body: data.body ?? null,
          createdAt: new Date(),
          fromMe: true,
          mediaUrl: data.mediaUrl ?? null,
          mimetype: "application/pdf",
          fileName: data.fileName,
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
