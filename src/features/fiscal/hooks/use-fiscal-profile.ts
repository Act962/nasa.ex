"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useFiscalProfile() {
  return useQuery(orpc.fiscal.profile.get.queryOptions({ input: {} }));
}


export function useUpsertFiscalProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.fiscal.profile.upsert.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal"] });
    },
  });
}
