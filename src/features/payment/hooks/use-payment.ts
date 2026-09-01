"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

// ── Access ────────────────────────────────────────────────────────────────────

export function usePaymentAccessList() {
  return useQuery(
    orpc.payment.access.list.queryOptions({ input: {} })
  );
}

export function useGrantPaymentAccess() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.access.grant.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: orpc.payment.key() }); },
  });
}

export function useRevokePaymentAccess() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.access.revoke.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: orpc.payment.key() }); },
  });
}

export function useMyPaymentAccess() {
  return useQuery(orpc.payment.access.getMy.queryOptions({ input: {} }));
}

export function useClaimOwnerPaymentAccess() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.access.claimOwner.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: orpc.payment.key() }); },
  });
}

export function useUpdatePaymentRole() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.access.updateRole.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: orpc.payment.key() }); },
  });
}

export function useUpdatePaymentPermissions() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.access.updatePermissions.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: orpc.payment.key() }); },
  });
}

export function useStartWebauthnRegistration() {
  return useMutation(orpc.payment.access.startWebauthnReg.mutationOptions());
}

export function useFinishWebauthnRegistration() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.access.finishWebauthnReg.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: orpc.payment.key() }); },
  });
}

export function useStartWebauthnAuth() {
  return useMutation(orpc.payment.access.startWebauthnAuth.mutationOptions());
}

export function useFinishWebauthnAuth() {
  return useMutation(orpc.payment.access.finishWebauthnAuth.mutationOptions());
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function usePaymentDashboard(params: {
  month?: number;
  year?: number;
  dateFrom?: string;
  dateTo?: string;
  categoryIds?: string[];
}) {
  return useQuery(orpc.payment.dashboard.get.queryOptions({ input: params }));
}

export function useCashflow(params: {
  month?: number;
  year?: number;
  dateFrom?: string;
  dateTo?: string;
  categoryIds?: string[];
}) {
  return useQuery(
    orpc.payment.dashboard.cashflow.queryOptions({ input: params }),
  );
}

// ── Entries ───────────────────────────────────────────────────────────────────

export function usePaymentEntries(params: {
  type?: "RECEIVABLE" | "PAYABLE";
  status?: "PENDING_APPROVAL" | "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";
  statuses?: Array<
    "PENDING_APPROVAL" | "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED"
  >;
  search?: string;
  page?: number;
  perPage?: number;
  dateFrom?: string;
  dateTo?: string;
  paidFrom?: string;
  paidTo?: string;
  categoryIds?: string[];
  enabled?: boolean;
}) {
  const { enabled = true, ...rest } = params;
  return useQuery({
    ...orpc.payment.entries.list.queryOptions({ input: rest }),
    enabled,
  });
}

/** Descrições usadas recentemente — atalhos de preenchimento no formulário. */
export function useRecentEntryDescriptions(
  type: "RECEIVABLE" | "PAYABLE",
  limit = 6,
) {
  return useQuery(
    orpc.payment.entries.recentDescriptions.queryOptions({
      input: { type, limit },
    }),
  );
}

/**
 * Busca sob demanda (não em render) os lançamentos de um período — usado pelo
 * botão "Exportar" do painel, que só precisa dos dados no clique.
 *
 * Percorre todas as páginas: antes parava na primeira (500 registros) e o CSV
 * saía truncado sem avisar quem exportou.
 */
const EXPORT_PAGE_SIZE = 500;
const EXPORT_MAX_PAGES = 40;

export function useExportPaymentEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      dateFrom?: string;
      dateTo?: string;
      categoryIds?: string[];
    }) => {
      const firstPage = await qc.fetchQuery(
        orpc.payment.entries.list.queryOptions({
          input: { ...input, page: 1, perPage: EXPORT_PAGE_SIZE },
        }),
      );

      const entries = [...firstPage.entries];
      for (
        let page = 2;
        entries.length < firstPage.total && page <= EXPORT_MAX_PAGES;
        page++
      ) {
        const nextPage = await qc.fetchQuery(
          orpc.payment.entries.list.queryOptions({
            input: { ...input, page, perPage: EXPORT_PAGE_SIZE },
          }),
        );
        if (nextPage.entries.length === 0) break;
        entries.push(...nextPage.entries);
      }

      return { entries, total: firstPage.total };
    },
  });
}

export function useCreatePaymentEntry() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.entries.create.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orpc.payment.key() });
    },
  });
}

export function useUpdatePaymentEntry() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.entries.update.mutationOptions(),
    // Retorna a promise pra que `mutateAsync`/`isPending` só resolvam depois
    // que a lista recarregar — o dialog de edição fecha com dados já atualizados.
    onSuccess: () => qc.invalidateQueries({ queryKey: orpc.payment.key() }),
  });
}

export function usePayEntry() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.entries.pay.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orpc.payment.key() });
    },
  });
}

export function useDeletePaymentEntry() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.entries.delete.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orpc.payment.key() });
    },
  });
}

export function useRemovePaymentEntry() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.entries.remove.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orpc.payment.key() });
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: orpc.payment.key() }); },
  });
}

export function useUpdatePaymentAccount() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.accounts.update.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: orpc.payment.key() }); },
  });
}

export function useDeletePaymentAccount() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.accounts.delete.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: orpc.payment.key() }); },
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: orpc.payment.key() }); },
  });
}

export function useUpdatePaymentCategory() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.categories.update.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: orpc.payment.key() }); },
  });
}

export function useDeletePaymentCategory() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.categories.delete.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: orpc.payment.key() }); },
  });
}

// ── External Contacts (Leads + Forge) ─────────────────────────────────────────

export function useExternalContacts(search?: string) {
  return useQuery(
    orpc.payment.externalContacts.list.queryOptions({ input: { search } })
  );
}

// ── Contacts ─────────────────────────────────────────────────────────────────

export function usePaymentContacts(
  search?: string,
  contactType?: string,
  pagination?: { page?: number; perPage?: number },
) {
  return useQuery(
    orpc.payment.contacts.list.queryOptions({
      input: {
        search,
        contactType,
        ...(pagination?.page ? { page: pagination.page } : {}),
        ...(pagination?.perPage ? { perPage: pagination.perPage } : {}),
      },
    }),
  );
}

export function useCreatePaymentContact() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.contacts.create.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: orpc.payment.key() }); },
  });
}

export function useUpdatePaymentContact() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.contacts.update.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: orpc.payment.key() }); },
  });
}

export function useDeletePaymentContact() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.contacts.delete.mutationOptions(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: orpc.payment.key() }); },
  });
}
