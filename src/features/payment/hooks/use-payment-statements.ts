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

function useStatementMutation<T extends { mutationOptions: () => object }>(
  procedure: T,
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...(procedure.mutationOptions() as object),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.payment.key() });
    },
  });
}

export function useInspectStatement() {
  return useMutation(orpc.payment.statements.inspect.mutationOptions());
}

export function useImportStatement() {
  return useStatementMutation(orpc.payment.statements.import);
}

export function useReconcileTransaction() {
  return useStatementMutation(orpc.payment.statements.transactions.reconcile);
}

export function useUnmatchTransaction() {
  return useStatementMutation(orpc.payment.statements.transactions.unmatch);
}

export function useCreateEntryFromTransaction() {
  return useStatementMutation(orpc.payment.statements.transactions.createEntry);
}

export function useIgnoreTransaction() {
  return useStatementMutation(orpc.payment.statements.transactions.ignore);
}
