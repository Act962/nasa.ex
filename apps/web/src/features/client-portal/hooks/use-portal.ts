"use client";

import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export function usePortal(clientCode: string) {
  const { data, isLoading, error } = useQuery({
    ...orpc.clientPortal.getPortal.queryOptions({ input: { clientCode } }),
    enabled: !!clientCode,
  });

  return {
    portal: data?.portal ?? null,
    isLoading,
    error,
  };
}
