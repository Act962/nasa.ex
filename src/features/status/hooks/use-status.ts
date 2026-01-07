"use client";

import { orpc } from "@/lib/orpc";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface UseSuspenseStatusOptions {
  trackingId: string;
  date_init?: Date;
  date_end?: Date;
  participant?: string;
}

export const useSuspenseStatus = ({
  trackingId,
  date_init,
  date_end,
  participant,
}: UseSuspenseStatusOptions) => {
  return useSuspenseQuery(
    orpc.status.list.queryOptions({
      input: {
        trackingId,
        date_init,
        date_end,
        participant,
      },
    })
  );
};

interface UseCreateStatusOptions {
  trackingId: string;
  onSuccess?: () => void;
}

export const useCreateStatus = ({
  trackingId,
  onSuccess,
}: UseCreateStatusOptions) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.status.create.mutationOptions({
      onSuccess: () => {
        toast.success("Status criado com sucesso!");

        queryClient.invalidateQueries({
          queryKey: orpc.status.list.queryKey({
            input: {
              trackingId,
            },
          }),
        });

        queryClient.invalidateQueries({
          queryKey: orpc.status.listSimple.queryKey({
            input: {
              trackingId,
            },
          }),
        });

        onSuccess?.();
      },
      onError: () => {
        toast.error("Erro ao criar status, tente novamente");
      },
    })
  );
};

export function useStatus(trackingId: string) {
  const { data, isLoading } = useQuery(
    orpc.status.listSimple.queryOptions({
      input: {
        trackingId,
      },
      enabled: !!trackingId,
    })
  );

  return {
    status: data?.status || [],
    isLoadingStatus: isLoading,
  };
}

export function useUpdateStatus(trackingId: string) {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.status.update.mutationOptions({
      onSuccess: () => {
        toast.success("Status atualizado com sucesso!");

        queryClient.invalidateQueries({
          queryKey: orpc.status.list.queryKey({
            input: {
              trackingId,
            },
          }),
        });

        queryClient.invalidateQueries({
          queryKey: orpc.status.listSimple.queryKey({
            input: {
              trackingId,
            },
          }),
        });
      },
      onError: () => {
        toast.error("Erro ao atualizar status, tente novamente");
      },
    })
  );
}
