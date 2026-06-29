import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useAiButtonPresets = (trackingId: string) => {
  const { data, isLoading } = useQuery(
    orpc.ia.buttonPresets.list.queryOptions({
      input: { trackingId },
    }),
  );

  return {
    presets: data?.presets ?? [],
    isLoadingPresets: isLoading,
  };
};

const invalidateList = (
  queryClient: ReturnType<typeof useQueryClient>,
  trackingId: string,
) =>
  queryClient.invalidateQueries(
    orpc.ia.buttonPresets.list.queryOptions({ input: { trackingId } }),
  );

export const useCreateAiButtonPreset = (trackingId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.ia.buttonPresets.create.mutationOptions({
      onSuccess: () => invalidateList(queryClient, trackingId),
    }),
  );
};

export const useUpdateAiButtonPreset = (trackingId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.ia.buttonPresets.update.mutationOptions({
      onSuccess: () => invalidateList(queryClient, trackingId),
    }),
  );
};

export const useDeleteAiButtonPreset = (trackingId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.ia.buttonPresets.delete.mutationOptions({
      onSuccess: () => invalidateList(queryClient, trackingId),
    }),
  );
};
