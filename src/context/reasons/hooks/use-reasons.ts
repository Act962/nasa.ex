import { useLostOrWin } from "@/hooks/use-lost-or-win";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export function useReasons(trackingId: string, type: "WIN" | "LOSS") {
  const { isOpen } = useLostOrWin();
  const { data, isLoading } = useQuery(
    orpc.reasons.listReasons.queryOptions({
      input: {
        trackingId,
        type,
      },
      enabled: !!trackingId || isOpen,
    })
  );

  return {
    reasons: data?.reasons || [],
    isLoading,
  };
}
