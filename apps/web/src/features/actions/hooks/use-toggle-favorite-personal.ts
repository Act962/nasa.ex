"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import {
  invalidateActionQueries,
  patchActionFavoriteInCaches,
} from "./favorite-cache";

export function useToggleFavoritePersonal(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.action.toggleFavoritePersonal.mutationOptions({
      // Optimistic update: flip the cached value immediately so the UI doesn't
      // depend on refetch keys matching exactly.
      onMutate: ({ actionId }) => {
        // We don't know the previous state here without reading caches — just
        // rely on the server's response and patch on success/error.
        return { actionId };
      },
      onSuccess: ({ actionId, favorited }) => {
        patchActionFavoriteInCaches(queryClient, actionId, {
          isFavoritedByMe: favorited,
        });
        toast.success(
          favorited
            ? "Adicionado aos seus favoritos"
            : "Removido dos seus favoritos",
        );
        invalidateActionQueries(queryClient, workspaceId);
      },
      onError: () => toast.error("Não foi possível atualizar o favorito"),
    }),
  );
}
