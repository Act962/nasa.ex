"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

// ── Access ────────────────────────────────────────────────────────────────────

export function usePaymentAccessList() {
  return useQuery(
    orpc.payment.access.list.queryOptions({ input: {} })
  );
}

export function useVerifyPaymentPin() {
  return useMutation(orpc.payment.access.verify.mutationOptions());
}

export function useGrantPaymentAccess() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.access.grant.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment"] }); },
  });
}

export function useRevokePaymentAccess() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.access.revoke.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment"] }); },
  });
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function usePaymentDashboard(month?: number, year?: number) {
  return useQuery(
    orpc.payment.dashboard.get.queryOptions({ input: { month, year } })
  );
}

export function useCashflow(month?: number, year?: number) {
  return useQuery(
    orpc.payment.dashboard.cashflow.queryOptions({ input: { month, year } })
  );
}

// ── Entries ───────────────────────────────────────────────────────────────────

export function usePaymentEntries(params: {
  type?: "RECEIVABLE" | "PAYABLE";
  status?: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";
  search?: string;
  page?: number;
  perPage?: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  return useQuery(
    orpc.payment.entries.list.queryOptions({ input: params })
  );
}

export function useCreatePaymentEntry() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.entries.create.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment"] });
    },
  });
}

export function useUpdatePaymentEntry() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.entries.update.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment"] });
    },
  });
}

export function usePayEntry() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.entries.pay.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment"] });
    },
  });
}

export function useDeletePaymentEntry() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.entries.delete.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment"] });
    },
  });
}

// ── Accounts ─────────────────────────────────────────────────────────────────

export function usePaymentAccounts() {
  return useQuery(
    orpc.payment.accounts.list.queryOptions({ input: {} })
  );
}

export function useCreatePaymentAccount() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.accounts.create.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment"] }); },
  });
}

export function useUpdatePaymentAccount() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.accounts.update.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment"] }); },
  });
}

export function useDeletePaymentAccount() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.accounts.delete.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment"] }); },
  });
}

// ── Categories ────────────────────────────────────────────────────────────────

export function usePaymentCategories(type?: "REVENUE" | "EXPENSE" | "COST") {
  return useQuery(
    orpc.payment.categories.list.queryOptions({ input: { type } })
  );
}

export function useCreatePaymentCategory() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.categories.create.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment"] }); },
  });
}

export function useUpdatePaymentCategory() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.categories.update.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment"] }); },
  });
}

export function useDeletePaymentCategory() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.categories.delete.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment"] }); },
  });
}

// ── External Contacts (Leads + Forge) ─────────────────────────────────────────

export function useExternalContacts(search?: string) {
  return useQuery(
    orpc.payment.externalContacts.list.queryOptions({ input: { search } })
  );
}

// ── Contacts ─────────────────────────────────────────────────────────────────

export function usePaymentContacts(search?: string, contactType?: string) {
  return useQuery(
    orpc.payment.contacts.list.queryOptions({ input: { search, contactType } })
  );
}

export function useCreatePaymentContact() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.contacts.create.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment"] }); },
  });
}

export function useUpdatePaymentContact() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.contacts.update.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment"] }); },
  });
}

export function useDeletePaymentContact() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.contacts.delete.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment"] }); },
  });
}
