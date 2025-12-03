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
                trackingId: data.tag.trackingId ?? "",
              },
            },
          }),
        });
        toast.success("Tag criada com sucesso!");
      },
      onError: () => {
        toast.error("Erro ao criar tag, tente novamente");
      },
    })
  );

  return {
    createTag: createTagMutation,
  };
}
