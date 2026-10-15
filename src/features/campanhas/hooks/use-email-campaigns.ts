import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Spec 0107: modelos e disparos de email das Campanhas.

export function useEmailTemplates() {
  return useQuery(orpc.campanhas.email.listTemplates.queryOptions({ input: {} }));
}

export function useSaveEmailTemplate() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.campanhas.email.saveTemplate.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.campanhas.email.listTemplates.key() });
      },
    }),
  );
}

export function useArchiveEmailTemplate() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.campanhas.email.archiveTemplate.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.campanhas.email.listTemplates.key() });
      },
    }),
  );
}

export function useSendTestEmail() {
  return useMutation(orpc.campanhas.email.sendTest.mutationOptions());
}

export function useEmailAudienceSummary(leadIds: string[], enabled: boolean) {
  return useQuery(
    orpc.campanhas.email.audienceSummary.queryOptions({
      input: { leadIds },
      enabled: enabled && leadIds.length > 0,
    }),
  );
}

export function useCreateEmailCampaign() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.campanhas.email.createCampaign.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.campanhas.email.listCampaigns.key() });
      },
    }),
  );
}

export function useEmailCampaigns() {
  return useQuery({
    ...orpc.campanhas.email.listCampaigns.queryOptions({ input: {} }),
    refetchInterval: (query) =>
      query.state.data?.campaigns.some((campaign) => campaign.status === "queued" || campaign.status === "sending")
        ? 5_000
        : false,
  });
}
