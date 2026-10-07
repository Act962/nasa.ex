import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import type { ServerLookupSource } from "@/features/form-records/lib/orbit-lookup-value";

export function useFormRecordLookup(params: {
  source: ServerLookupSource;
  query: string;
  sourceFormId?: string;
  enabled: boolean;
}) {
  return useQuery({
    ...orpc.formRecords.lookup.search.queryOptions({
      input: { source: params.source, query: params.query, sourceFormId: params.sourceFormId },
    }),
    enabled: params.enabled,
    staleTime: 15_000,
    retry: false,
  });
}
