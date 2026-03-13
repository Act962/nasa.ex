import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export function useListLeadsAtInsights(leadIds: string[]) {
  const { data, ...query } = useQuery(
    orpc.insights.listLeadsAtInsights.queryOptions({
      input: {
        leadIds,
      },
    }),
  );

  return {
    leads: data ?? [],
    ...query,
  };
}
