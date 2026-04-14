"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export function useSupport() {
  const createSupportMutation = useMutation(
    orpc.support.createSupportTicket.mutationOptions({
      onSuccess: () => {
        toast.success("Sugestão enviada com sucesso!");
      },
      onError: () => {
        toast.error("Erro ao enviar sugestão. Tente novamente.");
      },
    }),
  );

  return {
    createSupportTicket: createSupportMutation,
  };
}

export const useCreateSupportTicket = () => {
  return useMutation(
    orpc.support.createSupportTicket.mutationOptions({
      onSuccess: () => {
        toast.success("Sugestão enviada com sucesso!");
      },
      onError: () => {
        toast.error("Erro ao enviar sugestão. Tente novamente.");
      },
    }),
  );
};
