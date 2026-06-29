"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useNerpCatalogSettings() {
  return useQuery(orpc.nerp.catalogSettings.list.queryOptions({ input: {} }));
}

export function useUpdateNerpCatalogSettings() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nerp.catalogSettings.update.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: ["nerp"] }),
    }),
  );
}
