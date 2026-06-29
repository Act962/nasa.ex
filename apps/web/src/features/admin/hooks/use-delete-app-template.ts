"use client";

import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export function useDeleteAppTemplate() {
  return useMutation(
    orpc.admin.deleteAppTemplate.mutationOptions({
      onSuccess: () => {
        toast.success("Padrão removido com sucesso!");
      },
      onError: (error) => {
        console.error("[useDeleteAppTemplate] Error:", error);
        toast.error("Erro ao deletar padrão.");
      },
    }),
  );
}
