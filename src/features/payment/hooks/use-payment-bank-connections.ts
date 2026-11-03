"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

// Conexão da conta bancária com a API do banco (spec 0130). O estado vem em
// `usePaymentAccounts` (campo `bankConnection`); aqui ficam só as ações.

function useInvalidatePayment() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.payment.key() });
}

export function useSaveBankConnection() {
  const invalidatePayment = useInvalidatePayment();
  return useMutation({
    ...orpc.payment.bankConnections.save.mutationOptions(),
    onSuccess: invalidatePayment,
  });
}

export function useTestBankConnection() {
  const invalidatePayment = useInvalidatePayment();
  return useMutation({
    ...orpc.payment.bankConnections.test.mutationOptions(),
    onSettled: invalidatePayment,
  });
}

export function useSetChargeBankConnection() {
  const invalidatePayment = useInvalidatePayment();
  return useMutation({
    ...orpc.payment.bankConnections.setChargeAccount.mutationOptions(),
    onSuccess: invalidatePayment,
  });
}

export function useDisconnectBankConnection() {
  const invalidatePayment = useInvalidatePayment();
  return useMutation({
    ...orpc.payment.bankConnections.disconnect.mutationOptions(),
    onSuccess: invalidatePayment,
  });
}
