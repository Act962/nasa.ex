"use client";

/**
 * Hooks de aprovação de pagamento (Fase 2).
 *
 * Padrão NASA: cada hook embrulha `orpc.payment.approvals.*` em queries
 * tipadas com invalidação default nos mutations. Componentes consomem só
 * esses hooks — nunca `orpc` direto — pra facilitar refator de contrato.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/**
 * Lista de PaymentApprovalRequest status=PENDING que o user atual pode aprovar.
 * Retorna `{ requests, count }`. Auto-refresh a cada 60s pra capturar novos
 * pedidos sem precisar atualizar a aba.
 */
export function usePendingApprovals() {
  return useQuery({
    ...orpc.payment.approvals.listPending.queryOptions({ input: {} }),
    refetchInterval: 60_000,
  });
}

/**
 * Verifica se o user atual pode aprovar pagamentos na org ativa.
 * Usado pra mostrar/esconder a aba "Aprovações" e o botão "Aprovar" na UI.
 */
export function useCanApprovePayments() {
  return useQuery(orpc.payment.approvals.canApprove.queryOptions({ input: {} }));
}

export function useApprovePaymentRequest() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.approvals.approve.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment"] });
    },
  });
}

export function useRejectPaymentRequest() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.approvals.reject.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment"] });
    },
  });
}

export function useCancelPaymentApprovalRequest() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.approvals.cancel.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment"] });
    },
  });
}

// ── Governance config ─────────────────────────────────────────────────────

export function usePaymentGovernanceConfig() {
  return useQuery(orpc.payment.governance.get.queryOptions({ input: {} }));
}

export function useUpdatePaymentGovernanceConfig() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.payment.governance.update.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment", "governance"] });
    },
  });
}
