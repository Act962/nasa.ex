"use client";

/**
 * ApprovalsTab — aba "Aprovações" da PaymentPage.
 *
 * Lista de PaymentApprovalRequest pendentes que o user pode aprovar.
 * Filtragem (canApprove) é server-side em `payment.approvals.listPending` —
 * pra outros users a lista vem vazia.
 */

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  usePendingApprovals,
  useCanApprovePayments,
} from "../../hooks/use-payment-approvals";
import { ApprovalRequestCard } from "./approval-request-card";
import { ApprovalReviewModal } from "./approval-review-modal";

export function ApprovalsTab() {
  const canApproveQuery = useCanApprovePayments();
  const pendingQuery = usePendingApprovals();
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const canApprove = canApproveQuery.data?.canApprove ?? false;
  const isLoading = canApproveQuery.isLoading || pendingQuery.isLoading;
  const requests = pendingQuery.data?.requests ?? [];

  const reviewingRequest = requests.find((r) => r.id === reviewingId) ?? null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Carregando aprovações…
      </div>
    );
  }

  if (!canApprove) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <ShieldCheck className="size-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">
          Você não tem permissão para aprovar pagamentos
        </p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Apenas Master, Adm e usuários com permissão explícita em Financeiro
          podem aprovar. Peça ao Master da empresa para liberar.
        </p>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="size-12 rounded-full bg-green-50 flex items-center justify-center mb-3">
          <ShieldCheck className="size-6 text-green-600" />
        </div>
        <p className="text-sm font-medium">Nada pra aprovar agora</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Todos os pagamentos em PENDENTE_APROVAÇÃO já foram decididos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {requests.length} pagamento{requests.length === 1 ? "" : "s"} aguardando aprovação
        </h2>
      </div>

      <div className="space-y-2">
        {requests.map((req) => (
          <ApprovalRequestCard
            key={req.id}
            request={req}
            onReview={(id) => setReviewingId(id)}
          />
        ))}
      </div>

      <ApprovalReviewModal
        request={reviewingRequest}
        onClose={() => setReviewingId(null)}
      />
    </div>
  );
}
