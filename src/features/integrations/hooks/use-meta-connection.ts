"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** Situação da conexão Meta da org ativa (spec 0122). */
export const useMetaConnectionStatus = (params?: { enabled?: boolean }) => {
  return useQuery({
    ...orpc.platformIntegrations.metaConnection.status.queryOptions({}),
    enabled: params?.enabled ?? true,
  });
};

export const useTestMetaConnection = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.platformIntegrations.metaConnection.test.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.platformIntegrations.metaConnection.status.key({}) });
        qc.invalidateQueries({ queryKey: orpc.platformIntegrations.getMany.key({}) });
      },
    }),
  );
};
