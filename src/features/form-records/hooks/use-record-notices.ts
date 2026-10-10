import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

// Avisos das fichas no WhatsApp (spec 0081, parte C).

export function useRecordNotices() {
  return useQuery({ ...orpc.formRecords.notices.get.queryOptions(), retry: false });
}

export function useSaveRecordNotice() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.formRecords.notices.save.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.formRecords.notices.get.key() }),
    }),
  );
}
