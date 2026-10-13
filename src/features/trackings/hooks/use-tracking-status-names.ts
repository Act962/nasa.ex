import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

const STATUS_NAMES_STALE_MS = 5 * 60 * 1000;

/** Etapas do funil só com id e nome: a consulta leve, para rótulos (ex.: quadros do editor de fluxos). */
export function useTrackingStatusNames(trackingId: string | undefined) {
  return useQuery({
    ...orpc.status.listSimple.queryOptions({ input: { trackingId: trackingId ?? "" } }),
    enabled: Boolean(trackingId),
    staleTime: STATUS_NAMES_STALE_MS,
  });
}
