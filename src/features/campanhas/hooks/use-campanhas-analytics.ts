import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/** Analytics agregado das campanhas da org (Campanhas — seção Analytics). */
export const useCampanhasAnalytics = () => {
  return useQuery(orpc.campanhas.analytics.queryOptions());
};
