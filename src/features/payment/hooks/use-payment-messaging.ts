"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function usePaymentMessagingSender() {
  return useQuery(orpc.payment.messaging.getSender.queryOptions({ input: {} }));
}

export function useSetPaymentMessagingSender() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.messaging.setSender.mutationOptions(),
    onSuccess: () => qc.invalidateQueries({ queryKey: orpc.payment.messaging.key() }),
  });
}
