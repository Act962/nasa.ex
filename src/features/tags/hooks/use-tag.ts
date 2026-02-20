"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useTag() {
  const queryClient = useQueryClient();

  const createTagMutation = useMutation(
    orpc.tags.createTag.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: orpc.tags.listTags.queryKey({
            input: {
              query: {
                trackingId: data.trackingId ?? "",
              },
            },
          }),
        });
        toast.success("Tag criada com sucesso!");
      },
      onError: () => {
        toast.error("Erro ao criar tag, tente novamente");
      },
    }),
  );

  return {
    createTag: createTagMutation,
  };
}

export const syncWhatsappTagsMutation = (trackingId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.tags.syncWhatsappTags.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.tags.listTags.queryKey({
            input: {
              query: {
                trackingId,
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
