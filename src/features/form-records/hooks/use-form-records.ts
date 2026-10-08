import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useFormRecords(params: {
  formId: string;
  periodKey?: string;
  dateFrom?: string;
  dateTo?: string;
  leadId?: string;
  leadMemberId?: string;
  search?: string;
  page: number;
}) {
  return useQuery({
    ...orpc.formRecords.records.list.queryOptions({ input: params }),
    // Trocar o filtro mantém os números anteriores na tela até os novos chegarem.
    placeholderData: (previousData) => previousData,
    retry: false,
  });
}
