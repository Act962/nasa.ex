"use client";

import { useRouter } from "next/navigation";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation(
    orpc.admin.deleteNotification.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.admin.listNotifications.queryKey({
            input: {},
          }),
        });
        router.refresh();
        toast.success("Notificação excluída com sucesso!");
      },
      onError: () => {
        toast.error("Erro ao excluir notificação. Tente novamente.");
      },
    }),
  );
}
