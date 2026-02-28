import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useLeadFiles(leadId: string) {
  const { data, isLoading } = useQuery(
    orpc.leads.listFiles.queryOptions({
      input: {
        leadId,
      },
    }),
  );

  return {
    files: data?.leadFiles || [],
    isLoading,
  };
}

export function useCreateLeadFile(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.leads.createFile.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.leads.listFiles.queryKey({
            input: {
              leadId,
            },
          }),
        });
      },
    }),
  );
}
