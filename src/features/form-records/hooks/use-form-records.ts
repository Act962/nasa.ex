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
  nextDue?: "overdue" | "week" | "month";
  page: number;
}) {
  return useQuery({
    ...orpc.formRecords.records.list.queryOptions({ input: params }),
    // Trocar o filtro mantém os números anteriores na tela até os novos chegarem.
    placeholderData: (previousData) => previousData,
    retry: false,
  });
}

/** Tela inicial das fichas: o que falta preencher, o que está pronto e os clientes. */
export function useFormWorkspace(formId: string) {
  return useQuery({
    ...orpc.formRecords.workspace.get.queryOptions({ input: { formId } }),
    retry: false,
  });
}
