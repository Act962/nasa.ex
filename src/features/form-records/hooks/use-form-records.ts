import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useFormRecords(params: {
  formId: string;
  periodKey?: string;
  leadId?: string;
  search?: string;
  page: number;
}) {
  return useQuery({
    ...orpc.formRecords.records.list.queryOptions({ input: params }),
    retry: false,
  });
}
