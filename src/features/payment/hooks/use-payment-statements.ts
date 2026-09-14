"use client";

/**
 * Hooks da conciliação bancária (spec 0013).
 * Componentes consomem só estes hooks, nunca `orpc` direto.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useStatementTransactions(params: {
  accountId?: string;
  status?: "PENDING" | "MATCHED" | "IGNORED";
  direction?: "CREDIT" | "DEBIT";
  search?: string;
  page?: number;
  enabled?: boolean;
}) {
  const { enabled = true, page = 1, status = "PENDING", ...rest } = params;
  return useQuery({
    ...orpc.payment.statements.transactions.list.queryOptions({
      input: { ...rest, status, page, withSuggestions: status === "PENDING" },
    }),
    enabled,
  });
}

export function useStatementImports(params: { accountId?: string } = {}) {
  return useQuery(
    orpc.payment.statements.listImports.queryOptions({
      input: { accountId: params.accountId, limit: 10 },
    }),
  );
}

function useInvalidatePayment() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.payment.key() });
}

export function useInspectStatement() {
  return useMutation(orpc.payment.statements.inspect.mutationOptions());
}

export function useImportStatement() {
  const invalidatePayment = useInvalidatePayment();
  return useMutation(
    orpc.payment.statements.import.mutationOptions({ onSuccess: invalidatePayment }),
  );
}

export function useReconcileTransaction() {
  const invalidatePayment = useInvalidatePayment();
  return useMutation(
    orpc.payment.statements.transactions.reconcile.mutationOptions({
      onSuccess: invalidatePayment,
    }),
  );
}

export function useUnmatchTransaction() {
  const invalidatePayment = useInvalidatePayment();
  return useMutation(
    orpc.payment.statements.transactions.unmatch.mutationOptions({
      onSuccess: invalidatePayment,
    }),
  );
}

export function useCreateEntryFromTransaction() {
  const invalidatePayment = useInvalidatePayment();
  return useMutation(
    orpc.payment.statements.transactions.createEntry.mutationOptions({
      onSuccess: invalidatePayment,
    }),
  );
}

export function useIgnoreTransaction() {
  const invalidatePayment = useInvalidatePayment();
  return useMutation(
    orpc.payment.statements.transactions.ignore.mutationOptions({
      onSuccess: invalidatePayment,
    }),
  );
}
