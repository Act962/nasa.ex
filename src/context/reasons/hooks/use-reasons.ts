import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export function useReasons(trackingId: string, type: "WIN" | "LOSS") {
  const { data, isLoading } = useQuery(
    orpc.reasons.listReasons.queryOptions({
      input: {
        trackingId,
        type,
      },
      enabled: !!trackingId,
    })
  );

  return {
    reasons: data?.reasons || [],
    isLoading,
  };
}
