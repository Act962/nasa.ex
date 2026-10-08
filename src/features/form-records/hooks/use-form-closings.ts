import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useFormClosing(params: { formId: string; periodKey: string; enabled?: boolean }) {
  return useQuery({
    ...orpc.formRecords.closings.get.queryOptions({ input: { formId: params.formId, periodKey: params.periodKey } }),
    enabled: params.enabled ?? true,
    retry: false,
  });
}

function useInvalidateFormRecords() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.formRecords.closings.get.key() });
    queryClient.invalidateQueries({ queryKey: orpc.formRecords.records.list.key() });
  };
}

export function useSaveClosingSharedCosts() {
  const invalidate = useInvalidateFormRecords();
  return useMutation(orpc.formRecords.closings.saveSharedCosts.mutationOptions({ onSuccess: invalidate }));
}

export function useCloseFormPeriod() {
  const invalidate = useInvalidateFormRecords();
  return useMutation(orpc.formRecords.closings.close.mutationOptions({ onSuccess: invalidate }));
}

export function useReopenFormPeriod() {
  const invalidate = useInvalidateFormRecords();
  return useMutation(orpc.formRecords.closings.reopen.mutationOptions({ onSuccess: invalidate }));
}

export function useGenerateClosingReceivables() {
  const invalidate = useInvalidateFormRecords();
  return useMutation(orpc.formRecords.closings.generateReceivables.mutationOptions({ onSuccess: invalidate }));
}
