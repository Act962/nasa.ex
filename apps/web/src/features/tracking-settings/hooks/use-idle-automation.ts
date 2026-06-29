import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useIdleAutomation = (trackingId: string) => {
  const { data, isLoading } = useQuery(
    orpc.tracking.getIdleAutomation.queryOptions({
      input: { trackingId },
    }),
  );

  return {
    config: data?.config ?? null,
    isLoading,
  };
};

export const useUpdateIdleAutomation = (trackingId: string) => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.tracking.updateIdleAutomation.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries(
          orpc.tracking.getIdleAutomation.queryOptions({
            input: { trackingId },
          }),
        ),
    }),
  );
};
