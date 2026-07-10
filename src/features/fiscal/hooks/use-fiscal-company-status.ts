"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useSyncFiscalCompanyStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.fiscal.profile.syncCompanyStatus.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries(
        orpc.fiscal.profile.get.queryOptions({ input: {} }),
      );
    },
  });
}
