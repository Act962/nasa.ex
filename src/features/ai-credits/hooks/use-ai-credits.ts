import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Créditos de IA: painel da plataforma (Admin) e da chave própria da empresa (Satélites) — spec 0055. */

const ALERT_LEVEL_STALE_MS = 5 * 60_000;

export function useAdminAiCredits() {
  return useQuery(orpc.admin.aiCredits.overview.queryOptions());
}

export function useAdminAiCreditsAlertLevel() {
  return useQuery({ ...orpc.admin.aiCredits.alertLevel.queryOptions(), staleTime: ALERT_LEVEL_STALE_MS });
}

export function useAddAdminAiCreditEntry() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.admin.aiCredits.addEntry.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.admin.aiCredits.key() }),
    }),
  );
}

export function useRemoveAdminAiCreditEntry() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.admin.aiCredits.removeEntry.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.admin.aiCredits.key() }),
    }),
  );
}

export function useOrganizationAiCredits(options: { enabled?: boolean } = {}) {
  return useQuery({ ...orpc.platformIntegrations.aiCredits.overview.queryOptions(), enabled: options.enabled ?? true });
}

export function useAddOrganizationAiCreditEntry() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.platformIntegrations.aiCredits.addEntry.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.platformIntegrations.aiCredits.key() }),
    }),
  );
}

export function useRemoveOrganizationAiCreditEntry() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.platformIntegrations.aiCredits.removeEntry.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.platformIntegrations.aiCredits.key() }),
    }),
  );
}
