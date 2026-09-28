"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import type { PaymentReminderStatusValue } from "../schemas/reminders";

export function usePaymentReminders(
  params: { entryId?: string; status?: PaymentReminderStatusValue; enabled?: boolean } = {},
) {
  return useQuery({
    ...orpc.payment.reminders.list.queryOptions({
      input: {
        ...(params.entryId ? { entryId: params.entryId } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
    }),
    enabled: params.enabled ?? true,
  });
}

export function useCreatePaymentReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.payment.reminders.create.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.payment.reminders.key() });
    },
  });
}

export function useCancelPaymentReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.payment.reminders.cancel.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.payment.reminders.key() });
    },
  });
}
