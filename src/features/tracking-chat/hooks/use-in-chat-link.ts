import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Link público do Chat do site (In-Chat) da organização. Mesma consulta do
 * banner e do selo do In-Chat — o React Query reaproveita o cache.
 */
export function useInChatLink(trackingId: string | null) {
  const query = useQuery({
    ...orpc.conversation.getInChatStatus.queryOptions({
      input: { trackingId: trackingId ?? "" },
    }),
    enabled: Boolean(trackingId),
    refetchInterval: 15 * 60_000,
  });
  const orgSlug = query.data?.orgSlug ?? null;
  const path = orgSlug ? `/whatsapp/${orgSlug}` : null;
  return {
    path,
    url: path && typeof window !== "undefined" ? `${window.location.origin}${path}` : path,
    isLoading: query.isLoading,
  };
}
