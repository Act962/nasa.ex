"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export type PaymentInboxStatus = "NEW" | "PROPOSED" | "ACCEPTED" | "IGNORED" | "FAILED";

export function usePaymentInboxConfig(params: { enabled?: boolean } = {}) {
  return useQuery({
    ...orpc.payment.inbox.getConfig.queryOptions({ input: {} }),
    enabled: params.enabled ?? true,
  });
}

export function usePaymentInboxItems(params: {
  statuses?: PaymentInboxStatus[];
  page?: number;
  perPage?: number;
  enabled?: boolean;
}) {
  return useQuery({
    ...orpc.payment.inbox.listItems.queryOptions({
      input: {
        page: params.page ?? 1,
        perPage: params.perPage ?? 20,
        ...(params.statuses && params.statuses.length > 0 ? { statuses: params.statuses } : {}),
      },
    }),
    enabled: params.enabled ?? true,
  });
}

export function useUpdatePaymentInboxConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.payment.inbox.updateConfig.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.payment.key() });
    },
  });
}

export function useIgnorePaymentInboxItem() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.payment.inbox.ignoreItem.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.payment.key() });
    },
  });
}

export function useSyncPaymentInboxNow() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.payment.inbox.syncNow.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.payment.key() });
    },
  });
}
