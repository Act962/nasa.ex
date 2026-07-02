"use client";

import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Reaproveita `orpc.integrations.get` (já usado em tracking-settings) só pra
 * saber se a tracking tem uma instância WhatsApp Oficial (Meta Cloud) —
 * é o que decide se o dashboard de analytics aparece na nav e na página.
 */
export const useHasMetaCloudInstance = (trackingId: string) => {
  const { data, isLoading } = useQuery(
    orpc.integrations.get.queryOptions({
      input: { trackingId },
    }),
  );

  return {
    hasMetaCloudInstance: data?.provider === "META_CLOUD",
    isLoading,
  };
};
