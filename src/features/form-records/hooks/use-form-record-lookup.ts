import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import type { ServerLookupSource } from "@/features/form-records/lib/orbit-lookup-value";

export function useFormRecordLookup(params: {
  source: ServerLookupSource;
  query: string;
  sourceFormId?: string;
  recordId?: string;
  enabled: boolean;
}) {
  return useQuery({
    ...orpc.formRecords.lookup.search.queryOptions({
      input: { source: params.source, query: params.query, sourceFormId: params.sourceFormId, recordId: params.recordId },
    }),
    enabled: params.enabled,
    staleTime: 15_000,
    retry: false,
  });
}

/** Tracking e etapa em que entra um cliente cadastrado pela tela de nova ficha. */
export function useQuickClientDefaults(formId: string, enabled: boolean) {
  return useQuery({
    ...orpc.formRecords.lookup.quickClientDefaults.queryOptions({ input: { formId } }),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}
