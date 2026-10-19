import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

// Score de atendimento no período (spec 0113, RF-16).
export function useAttendanceScore(params: { trackingId?: string; startDate?: string; endDate?: string; enabled?: boolean }) {
  const { enabled = true, ...input } = params;
  const { data, isLoading } = useQuery({
    ...orpc.insights.getAttendanceScore.queryOptions({ input }),
    enabled,
  });
  return { score: data ?? null, isLoading };
}
