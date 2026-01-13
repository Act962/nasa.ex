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

export const useQueryStatus = ({
  trackingId,
  date_init,
  date_end,
  participant,
}: UseSuspenseStatusOptions) => {
  const { data, isPending } = useQuery(
    orpc.status.list.queryOptions({
      input: {
        trackingId,
        date_init,
        date_end,
        participant,
      },
    })
  );

  return {
    status: data?.status ?? [],
    isStatusLoading: isPending,
  };
};

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

export const useCreateStatus = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.status.create.mutationOptions({
      onSuccess: (data) => {
        toast.success("Status criado com sucesso!");

        queryClient.invalidateQueries({
          queryKey: orpc.status.list.queryKey({
            input: {
              trackingId: data.trackingId,
            },
          }),
        });

        queryClient.invalidateQueries({
          queryKey: orpc.status.listSimple.queryKey({
            input: {
              trackingId: data.trackingId,
            },
          }),
        });
      },
      onError: () => {
        toast.error("Erro ao criar status, tente novamente");
      },
    })
  );
};

export const useUpdateStatusName = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.status.update.mutationOptions({
      onSuccess: (data) => {
        toast.success("Status atualizado com sucesso!");

        queryClient.invalidateQueries({
          queryKey: orpc.status.list.queryKey({
            input: {
              trackingId: data.trackingId,
            },
          }),
        });
      },
      onError: () => {
        toast.error("Erro ao atualizar status, tente novamente");
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

export const useUpdateStatusOrder = () => {
  return useMutation(
    orpc.status.updateOrder.mutationOptions({
      onSuccess: () => {
        toast.success("Coluna atualizada com sucesso!");
      },
      onError: () => {
        toast.error("Erro ao atualizar coluna, tente novamente");
        // setStatusData(status);
      },
    })
  );
};
