import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

// PIX das fichas (spec 0081, parte D).

export function useRecordPixSettings(isEnabled = true) {
  return useQuery({ ...orpc.formRecords.pix.settings.queryOptions(), enabled: isEnabled, retry: false });
}

export function useSaveRecordPixSettings() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.formRecords.pix.saveSettings.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.formRecords.pix.settings.key() });
        queryClient.invalidateQueries({ queryKey: orpc.formRecords.pix.status.key() });
      },
    }),
  );
}

export function useRecordPixStatus(responseId: string) {
  return useQuery({ ...orpc.formRecords.pix.status.queryOptions({ input: { responseId } }), retry: false });
}

function useInvalidatePixStatus() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.formRecords.pix.status.key() });
}

export function useSendRecordPix() {
  const invalidate = useInvalidatePixStatus();
  return useMutation(orpc.formRecords.pix.send.mutationOptions({ onSuccess: invalidate }));
}

export function useMarkRecordPaid() {
  const invalidate = useInvalidatePixStatus();
  return useMutation(orpc.formRecords.pix.markPaid.mutationOptions({ onSuccess: invalidate }));
}
