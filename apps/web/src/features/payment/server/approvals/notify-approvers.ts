import "server-only";

import prisma from "@/lib/prisma";
import {
  createNotification,
  NOTIF_TYPES,
} from "@/features/admin/lib/notification-service";
import { listPaymentApproverIds } from "../can-approve-payment";

/**
 * Notifica todos os aprovadores elegíveis sobre uma PaymentApprovalRequest.
 *
 * Usa `listPaymentApproverIds` pra resolver quem pode aprovar (owner, admin
 * c/ default True ou outras roles c/ override True), exclui quem CRIOU o
 * pedido (pra não notificar a si mesmo), e cria uma `UserNotification` por
 * aprovador. Pusher dispara automaticamente via `createNotification`.
 *
 * Não falha se 0 aprovadores forem resolvidos — só loga warning.
 */
export async function notifyApproversOfRequest(opts: {
  organizationId: string;
  requestId: string;
  entryId: string;
  requestedById: string;
  amount: number; // em centavos
  description: string;
  type: "PAYABLE" | "RECEIVABLE";
}) {
  const approverIds = (await listPaymentApproverIds(opts.organizationId))
    .filter((id) => id !== opts.requestedById);

  if (approverIds.length === 0) {
    console.warn(
      "[notifyApproversOfRequest] no eligible approvers for request",
      opts.requestId,
    );
    return { notified: 0 };
  }

  const valor = (opts.amount / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const title = "Aprovação de pagamento pendente";
  const body = `${opts.description} (${valor}) aguarda sua aprovação`;
  const actionUrl = `/payment?tab=approvals&request=${opts.requestId}`;

  await Promise.all(
    approverIds.map((userId) =>
      createNotification({
        userId,
        organizationId: opts.organizationId,
        type: NOTIF_TYPES.PAYMENT_APPROVAL_PENDING,
        title,
        body,
        appKey: "financeiro",
        actionUrl,
        metadata: {
          requestId: opts.requestId,
          entryId: opts.entryId,
          amount: opts.amount,
          entryType: opts.type,
        },
        severity: "info",
      }).catch((err) => {
        console.error(
          `[notifyApproversOfRequest] createNotification failed for user ${userId}:`,
          err,
        );
      }),
    ),
  );

  // Marca timestamp de notificação no request (anti-spam do cron de reminder).
  await prisma.paymentApprovalRequest.update({
    where: { id: opts.requestId },
    data: { lastNotifiedAt: new Date() },
  });

  return { notified: approverIds.length };
}

/**
 * Notifica o requester quando a request é decidida (aprovada ou rejeitada).
 * Usado em `approve.ts` / `reject.ts`.
 */
export async function notifyRequesterOfDecision(opts: {
  organizationId: string;
  requestId: string;
  requestedById: string;
  decidedByName: string;
  decision: "APPROVE" | "REJECT";
  reason?: string | null;
  entryDescription: string;
}) {
  const approved = opts.decision === "APPROVE";
  const title = approved ? "Pagamento aprovado" : "Pagamento rejeitado";
  const body = approved
    ? `${opts.decidedByName} aprovou "${opts.entryDescription}"`
    : `${opts.decidedByName} rejeitou "${opts.entryDescription}"${opts.reason ? ` — ${opts.reason}` : ""}`;
  const actionUrl = `/payment?tab=approvals&request=${opts.requestId}`;

  await createNotification({
    userId: opts.requestedById,
    organizationId: opts.organizationId,
    type: approved
      ? NOTIF_TYPES.PAYMENT_APPROVAL_APPROVED
      : NOTIF_TYPES.PAYMENT_APPROVAL_REJECTED,
    title,
    body,
    appKey: "financeiro",
    actionUrl,
    metadata: {
      requestId: opts.requestId,
      decision: opts.decision,
      reason: opts.reason ?? null,
    },
    severity: approved ? "info" : "warning",
  });
}
