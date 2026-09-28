import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Lista os números WhatsApp Oficial (`META_CLOUD`) da org disponíveis como
 * origem de uma campanha. Alimenta o seletor no dialog de criação.
 */
export const useSendingNumbers = (options?: { enabled?: boolean }) => {
  return useQuery({
    ...orpc.campanhas.listSendingNumbers.queryOptions(),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
};
