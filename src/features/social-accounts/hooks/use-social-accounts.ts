"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/** Contas de redes sociais conectadas pela organização (spec 0069): toda chamada oRPC do domínio. */

function useInvalidateSocialAccounts() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: orpc.socialAccounts.key() });
    // Comments, órbita dos Satélites e Planner leem das mesmas contas.
    void queryClient.invalidateQueries({ queryKey: orpc.comments.key() });
    void queryClient.invalidateQueries({ queryKey: orpc.platformIntegrations.key() });
    void queryClient.invalidateQueries({ queryKey: orpc.nasaPlanner.key() });
  };
}

export function useSocialAccounts({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ ...orpc.socialAccounts.list.queryOptions({ input: {} }), enabled });
}

export function useConnectSocialAccount() {
  const invalidate = useInvalidateSocialAccounts();
  return useMutation(orpc.socialAccounts.connect.mutationOptions({ onSuccess: invalidate }));
}

/** Troca a credencial de uma conta já conectada; a conta em si nunca muda. */
export function useReconnectSocialAccount() {
  const invalidate = useInvalidateSocialAccounts();
  return useMutation(orpc.socialAccounts.reconnect.mutationOptions({ onSuccess: invalidate }));
}

export function useDisconnectSocialAccount() {
  const invalidate = useInvalidateSocialAccounts();
  return useMutation(orpc.socialAccounts.disconnect.mutationOptions({ onSuccess: invalidate }));
}

export function useReactivateSocialAccount() {
  const invalidate = useInvalidateSocialAccounts();
  return useMutation(orpc.socialAccounts.reactivate.mutationOptions({ onSuccess: invalidate }));
}

/**
 * Reinscreve o app nos eventos da conta. Assinar os campos no painel da Meta
 * não basta — sem isto a conta não entrega nada.
 */
export function useRepairSocialAccountSubscription() {
  const invalidate = useInvalidateSocialAccounts();
  return useMutation(orpc.socialAccounts.repairSubscription.mutationOptions({ onSuccess: invalidate }));
}

/** URL e verify token do webhook de uma conta, para o passo final do guia (só admin). */
export function useSocialAccountWebhookSetup(channelId: string | null) {
  return useQuery({
    ...orpc.socialAccounts.webhookSetup.queryOptions({ input: { channelId: channelId ?? "" } }),
    enabled: Boolean(channelId),
  });
}

/** Instagram da conexão da Meta da empresa, para conectar com um clique (spec 0061). */
export function useMetaInstagramAccounts({ organizationId, enabled = true }: { organizationId?: string; enabled?: boolean } = {}) {
  return useQuery({
    ...orpc.socialAccounts.metaAccounts.queryOptions({ input: { organizationId } }),
    enabled,
  });
}

export function useConnectSocialAccountWithMeta() {
  const invalidate = useInvalidateSocialAccounts();
  return useMutation(orpc.socialAccounts.connectWithMeta.mutationOptions({ onSuccess: invalidate }));
}

export type SocialAccount = NonNullable<ReturnType<typeof useSocialAccounts>["data"]>["accounts"][number];
