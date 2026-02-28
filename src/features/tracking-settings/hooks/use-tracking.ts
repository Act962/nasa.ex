import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useQueryTracking() {
  const { data, isLoading } = useQuery(orpc.tracking.list.queryOptions({}));

  return {
    trackings: data || [],
    isLoadingTrackings: isLoading,
  };
}

export const useQueryAiSettings = (trackingId: string) => {
  const { data, isLoading } = useQuery(
    orpc.ia.settings.get.queryOptions({
      input: {
        trackingId,
      },
    }),
  );

  return {
    settings: data?.settings,
    isLoadingSettings: isLoading,
  };
};

export const useUpdateAiSettings = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.ia.settings.update.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Configurações da IA atualizada com sucesso!`);

        queryClient.invalidateQueries(
          orpc.tracking.get.queryOptions({
            input: { trackingId: data.trackingId },
          }),
        );

        queryClient.invalidateQueries(
          orpc.ia.settings.get.queryOptions({
            input: { trackingId: data.trackingId },
          }),
        );
      },
    }),
  );
};
