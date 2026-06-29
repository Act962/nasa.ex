"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import {
  invalidateActionQueries,
  patchActionFavoriteInCaches,
} from "./favorite-cache";

export function useToggleFavoriteGlobal(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.action.toggleFavoriteGlobal.mutationOptions({
      onSuccess: ({ actionId, isFavorited }) => {
        patchActionFavoriteInCaches(queryClient, actionId, {
          isFavorited,
        });
        toast.success(
          isFavorited ? "Fixado para todos" : "Desfixado de todos",
        );
        invalidateActionQueries(queryClient, workspaceId);
      },
      onError: (err) => {
        const msg = (err as { message?: string })?.message;
        toast.error(
          msg && (msg.includes("Owner") || msg.includes("permissão"))
            ? msg
            : "Não foi possível alterar o favorito global",
        );
      },
    }),
  );
}
