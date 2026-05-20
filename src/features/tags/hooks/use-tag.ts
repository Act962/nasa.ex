"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const useCreateTag = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.tags.createTag.mutationOptions({
      onMutate: async (newTag) => {
        const specificKey = orpc.tags.listTags.queryKey({
          input: { query: { trackingId: newTag.trackingId ?? undefined } },
        });
        const globalKey = orpc.tags.listTags.queryKey({
          input: { query: { trackingId: undefined } },
        });

        // Cancel any outgoing refetches
        await queryClient.cancelQueries({ queryKey: specificKey });
        await queryClient.cancelQueries({ queryKey: globalKey });

        // Snapshot the previous value
        const previousSpecific = queryClient.getQueryData(specificKey);
        const previousGlobal = queryClient.getQueryData(globalKey);

        // Optimistically update to the specific tracking list
        queryClient.setQueryData(specificKey, (old: any) => {
          if (!old) return old;
          return {
            ...old,
            tags: [...(old.tags || []), { ...newTag, id: "temp-id" }],
          };
        });

        // Optimistically update to the global list
        queryClient.setQueryData(globalKey, (old: any) => {
          if (!old) return old;
          return {
            ...old,
            tags: [...(old.tags || []), { ...newTag, id: "temp-id" }],
          };
        });

        return { previousSpecific, previousGlobal };
      },
      onSuccess: (data) => {
        // Invalidate specific tracking tags
        queryClient.invalidateQueries({
          queryKey: orpc.tags.listTags.queryKey({
            input: {
              query: {
                trackingId: data.trackingId ?? undefined,
              },
            },
          }),
        });

        // Invalidate global tags (trackingId: undefined)
        queryClient.invalidateQueries({
          queryKey: orpc.tags.listTags.queryKey({
            input: {
              query: {
                trackingId: undefined,
              },
            },
          }),
        });

        toast.success("Tag criada com sucesso!");
      },
      onError: (error, _newTag, context) => {
        // Rollback on error
        if (context?.previousSpecific) {
          queryClient.setQueryData(
            orpc.tags.listTags.queryKey({
              input: { query: { trackingId: _newTag.trackingId ?? undefined } },
            }),
            context.previousSpecific,
          );
        }
        if (context?.previousGlobal) {
          queryClient.setQueryData(
            orpc.tags.listTags.queryKey({
              input: { query: { trackingId: undefined } },
            }),
            context.previousGlobal,
          );
        }

        if (error.message === "Tag já existe") {
          toast.error("Tag já existe");
          return;
        }
        toast.error("Erro ao criar tag, tente novamente");
      },
    }),
  );
};

export const useSyncWhatsappTagsMutation = (trackingId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.tags.syncWhatsappTags.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.tags.listTags.queryKey({
            input: {
              query: {
                trackingId: trackingId,
              },
            },
          }),
        });
        toast.success("Tags sincronizadas com sucesso!");
      },
      onError: () => {
        toast.error("Erro ao sincronizar tags, tente novamente");
      },
    }),
  );
};
