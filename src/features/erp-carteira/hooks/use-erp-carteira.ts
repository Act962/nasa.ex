import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const RUNNING_REFRESH_MS = 5_000;

export function useErpCarteiraStatus() {
  return useQuery({
    ...orpc.nerp.erpCarteira.status.queryOptions({ input: {} }),
    refetchInterval: (query) => {
      const status = query.state.data?.record?.status;
      return status === "running" || status === "queued" ? RUNNING_REFRESH_MS : false;
    },
  });
}

export function useStartErpCarteiraImport() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.nerp.erpCarteira.start.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.nerp.erpCarteira.status.key() });
      },
    }),
  );
}

export function useLeadErpProfile(leadId: string) {
  return useQuery(
    orpc.nerp.erpCarteira.leadProfile.queryOptions({ input: { leadId }, enabled: !!leadId }),
  );
}
