"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

function useInvalidateChannel() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.comments.key() });
}

export function useCommentsChannel() {
  return useQuery(orpc.comments.channel.get.queryOptions({ input: {} }));
}

/** URL e verify token do webhook, para o passo final do guia (só admin). */
export function useCommentsWebhookSetup({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    ...orpc.comments.channel.webhookSetup.queryOptions({ input: {} }),
    enabled,
  });
}

export function useConnectCommentsChannel() {
  const invalidate = useInvalidateChannel();
  return useMutation(
    orpc.comments.channel.connect.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useDisconnectCommentsChannel() {
  const invalidate = useInvalidateChannel();
  return useMutation(
    orpc.comments.channel.disconnect.mutationOptions({ onSuccess: invalidate }),
  );
}

/**
 * Reinscreve o app nos eventos da conta. Assinar os campos no painel da Meta
 * não basta — sem isto a conta não entrega nada.
 */
export function useRepairCommentsSubscription() {
  const invalidate = useInvalidateChannel();
  return useMutation(
    orpc.comments.channel.repairSubscription.mutationOptions({
      onSuccess: invalidate,
    }),
  );
}

export function useReactivateCommentsChannel() {
  const invalidate = useInvalidateChannel();
  return useMutation(
    orpc.comments.channel.reactivate.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useCommentsContent(enabled = true) {
  return useQuery({
    ...orpc.comments.channel.listContent.queryOptions({ input: {} }),
    enabled,
  });
}

/** Instagram da conexão da Meta da empresa, para conectar o Comments com um clique (spec 0061). */
export function useCommentsMetaAccounts({ organizationId, enabled = true }: { organizationId?: string; enabled?: boolean } = {}) {
  return useQuery({
    ...orpc.comments.channel.metaAccounts.queryOptions({ input: { organizationId } }),
    enabled,
  });
}

export function useConnectCommentsWithMeta() {
  const invalidate = useInvalidateChannel();
  const queryClient = useQueryClient();
  return useMutation(
    orpc.comments.channel.connectWithMeta.mutationOptions({
      onSuccess: () => {
        invalidate();
        void queryClient.invalidateQueries({ queryKey: orpc.nasaPlanner.key() });
      },
    }),
  );
}

/** Tracking que recebe os leads do Instagram no tracking-chat (spec 0062). */
export function useCommentsLeadTracking({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ ...orpc.comments.channel.leadTracking.queryOptions({ input: {} }), enabled });
}

export function useSetCommentsLeadTracking() {
  const invalidate = useInvalidateChannel();
  return useMutation(orpc.comments.channel.setLeadTracking.mutationOptions({ onSuccess: invalidate }));
}
