"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

// Transferências com prazo do Nbox (spec 0148, RF-7 e RF-11).

export const useNboxTransfers = () => {
  const { data, isLoading } = useQuery(orpc.nbox.transfers.getMany.queryOptions({}));
  return { transfers: data?.transfers ?? [], isLoading };
};

export const useCreateNboxTransfer = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.nbox.transfers.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.nbox.transfers.key() });
        queryClient.invalidateQueries({ queryKey: orpc.nbox.getStorage.key() });
      },
    }),
  );
};

export const useUpdateNboxTransfer = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.nbox.transfers.update.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.nbox.transfers.key() }),
    }),
  );
};
