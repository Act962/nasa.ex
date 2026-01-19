import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useListTrackingParticipants(trackingId: string) {
  return useQuery(
    orpc.tracking.listParticipants.queryOptions({
      input: {
        trackingId,
      },
    }),
  );
}
