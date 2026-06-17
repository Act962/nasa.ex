/**
 * Procedures de aprovação de pagamento (Fase 2).
 *
 * Fluxo:
 *   1. Entry é criada em `createPaymentEntry` com `status=PENDING_APPROVAL`
 *      e um `PaymentApprovalRequest` é gerado automaticamente quando trigger
 *      (ver `should-trigger-approval.ts`).
 *   2. Aprovadores elegíveis (owner/admin/c canApprove=true) são notificados
 *      via `notifyApproversOfRequest` (UserNotification + Pusher).
 *   3. Aprovador abre o detalhe na aba "Aprovações" e clica Aprovar/Rejeitar.
 *   4. Decisão grava 1 `PaymentApprovalDecision` (trilha de auditoria),
 *      atualiza o request status, ramifica `PaymentEntry.status`:
 *        - APPROVE → PENDING (entra no fluxo legado de pagamento)
 *        - REJECT  → CANCELLED + motivo no audit log
 *   5. Notifica o requester via `notifyRequesterOfDecision`.
 *
 * Quórum: MVP sempre `minApprovers=1`; estrutura preparada pra Fase 2.5 com
 * N>1 sem migration (basta o handler de approve contar `APPROVE` distintos).
 */

import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { logActivity } from "@/features/admin/lib/activity-logger";
import {
  canUserApprovePayment,
} from "@/features/payment/server/can-approve-payment";
import {
  notifyApproversOfRequest,
  notifyRequesterOfDecision,
} from "@/features/payment/server/approvals/notify-approvers";

const approvalStatusEnum = z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);

const pendingRequestShape = z.object({
  id:             z.string(),
  entryId:        z.string(),
  requestedById:  z.string(),
  requestedAt:    z.date(),
  status:         approvalStatusEnum,
  decidedAt:      z.date().nullable(),
  entry: z.object({
    id:          z.string(),
    description: z.string(),
    amount:      z.number(),
    type:        z.string(),
    dueDate:     z.date(),
    contact:     z.object({ id: z.string(), name: z.string() }).nullable(),
    category:    z.object({ id: z.string(), name: z.string(), color: z.string().nullable() }).nullable(),
  }),
  requestedBy: z.object({ id: z.string(), name: z.string(), email: z.string(), image: z.string().nullable() }),
});

export const listPendingPaymentApprovals = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "List pending payment approvals for the current user", tags: ["Payment"] })
  .input(z.object({}))
  .output(z.object({ requests: z.array(pendingRequestShape), count: z.number() }))
  .handler(async ({ context }) => {
    // Só retorna a fila se o user pode aprovar. Caso contrário, lista vazia.
    const canApprove = await canUserApprovePayment(
      context.user.id,
      context.org.id,
    );
    if (!canApprove) return { requests: [], count: 0 };

    const requests = await prisma.paymentApprovalRequest.findMany({
      where: { organizationId: context.org.id, status: "PENDING" },
      include: {
        entry: {
          select: {
            id: true,
            description: true,
            amount: true,
            type: true,
            dueDate: true,
            contact: { select: { id: true, name: true } },
            category: { select: { id: true, name: true, color: true } },
          },
        },
        requestedBy: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { requestedAt: "desc" },
    });

    return { requests, count: requests.length };
  });

export const canCurrentUserApprovePayment = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Check if current user can approve payments", tags: ["Payment"] })
  .input(z.object({}))
  .output(z.object({ canApprove: z.boolean() }))
  .handler(async ({ context }) => {
    const canApprove = await canUserApprovePayment(
      context.user.id,
      context.org.id,
    );
    return { canApprove };
  });

async function ensureCanApprove(userId: string, orgId: string) {
  const ok = await canUserApprovePayment(userId, orgId);
  if (!ok) {
    throw new ORPCError("FORBIDDEN", {
      message: "Você não tem permissão para aprovar pagamentos nesta empresa",
    });
  }
}

export const approvePaymentRequest = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Approve a payment request", tags: ["Payment"] })
  .input(z.object({
    requestId: z.string(),
    reason:    z.string().max(500).optional(),
  }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    await ensureCanApprove(context.user.id, context.org.id);

    const request = await prisma.paymentApprovalRequest.findFirst({
      where: { id: input.requestId, organizationId: context.org.id },
      include: { entry: { select: { id: true, description: true } } },
    });
    if (!request) {
      throw new ORPCError("NOT_FOUND", { message: "Pedido de aprovação não encontrado" });
    }
    if (request.status !== "PENDING") {
      throw new ORPCError("BAD_REQUEST", {
        message: `Pedido já está ${request.status.toLowerCase()}`,
      });
    }

    const now = new Date();

    // Conta decisões APPROVE distintas (preparado pra quórum N>1 sem migration).
    await prisma.paymentApprovalDecision.create({
      data: {
        requestId: request.id,
        userId:    context.user.id,
        decision:  "APPROVE",
        reason:    input.reason ?? null,
        decidedAt: now,
      },
    });
    const approveCount = await prisma.paymentApprovalDecision.count({
      where: { requestId: request.id, decision: "APPROVE" },
    });

    if (approveCount >= request.minApprovers) {
      // Quórum atingido → APPROVED
      await prisma.$transaction([
        prisma.paymentApprovalRequest.update({
          where: { id: request.id },
          data:  { status: "APPROVED", decidedAt: now },
        }),
        // Entry vira PENDING (entra no fluxo legado de pagamento).
        prisma.paymentEntry.update({
          where: { id: request.entryId },
          data:  { status: "PENDING" },
        }),
      ]);
      await notifyRequesterOfDecision({
        organizationId:   context.org.id,
        requestId:        request.id,
        requestedById:    request.requestedById,
        decidedByName:    context.user.name,
        decision:         "APPROVE",
        reason:           input.reason ?? null,
        entryDescription: request.entry.description,
      });
    }

    await logActivity({
      organizationId: context.org.id,
      userId:    context.user.id,
      userName:  context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug:    "payment",
      subAppSlug: "payment-approvals",
      featureKey: "payment.approval.approved",
      action:     "payment.approval.approved",
      actionLabel: `Aprovou pagamento "${request.entry.description}"`,
      resource:    request.entry.description,
      resourceId:  request.id,
      metadata: { entryId: request.entryId, reason: input.reason ?? null },
    });

    return { success: true };
  });

export const rejectPaymentRequest = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Reject a payment request", tags: ["Payment"] })
  .input(z.object({
    requestId: z.string(),
    reason:    z.string().min(1, "Motivo obrigatório na rejeição").max(500),
  }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    await ensureCanApprove(context.user.id, context.org.id);

    const request = await prisma.paymentApprovalRequest.findFirst({
      where: { id: input.requestId, organizationId: context.org.id },
      include: { entry: { select: { id: true, description: true } } },
    });
    if (!request) {
      throw new ORPCError("NOT_FOUND", { message: "Pedido de aprovação não encontrado" });
    }
    if (request.status !== "PENDING") {
      throw new ORPCError("BAD_REQUEST", { message: `Pedido já está ${request.status.toLowerCase()}` });
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.paymentApprovalDecision.create({
        data: {
          requestId: request.id,
          userId:    context.user.id,
          decision:  "REJECT",
          reason:    input.reason,
          decidedAt: now,
        },
      }),
      prisma.paymentApprovalRequest.update({
        where: { id: request.id },
        data:  { status: "REJECTED", decidedAt: now },
      }),
      // Entry vira CANCELLED — rejeição é terminal no MVP.
      prisma.paymentEntry.update({
        where: { id: request.entryId },
        data:  { status: "CANCELLED" },
      }),
    ]);

    await notifyRequesterOfDecision({
      organizationId:   context.org.id,
      requestId:        request.id,
      requestedById:    request.requestedById,
      decidedByName:    context.user.name,
      decision:         "REJECT",
      reason:           input.reason,
      entryDescription: request.entry.description,
    });

    await logActivity({
      organizationId: context.org.id,
      userId:    context.user.id,
      userName:  context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug:    "payment",
      subAppSlug: "payment-approvals",
      featureKey: "payment.approval.rejected",
      action:     "payment.approval.rejected",
      actionLabel: `Rejeitou pagamento "${request.entry.description}" — ${input.reason}`,
      resource:    request.entry.description,
      resourceId:  request.id,
      metadata: { entryId: request.entryId, reason: input.reason },
    });

    return { success: true };
  });

export const cancelPaymentApprovalRequest = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Cancel a pending payment approval (only owner or requester)", tags: ["Payment"] })
  .input(z.object({ requestId: z.string(), reason: z.string().optional() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    const request = await prisma.paymentApprovalRequest.findFirst({
      where: { id: input.requestId, organizationId: context.org.id },
      include: { entry: { select: { id: true, description: true } } },
    });
    if (!request) {
      throw new ORPCError("NOT_FOUND", { message: "Pedido de aprovação não encontrado" });
    }
    if (request.status !== "PENDING") {
      throw new ORPCError("BAD_REQUEST", { message: `Pedido já está ${request.status.toLowerCase()}` });
    }

    // Só o próprio requester OU owner podem cancelar antes da decisão.
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { role: true },
    });
    const isOwner     = member?.role === "owner";
    const isRequester = request.requestedById === context.user.id;
    if (!isOwner && !isRequester) {
      throw new ORPCError("FORBIDDEN", {
        message: "Apenas o solicitante ou o Master podem cancelar este pedido",
      });
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.paymentApprovalRequest.update({
        where: { id: request.id },
        data:  { status: "CANCELLED", decidedAt: now },
      }),
      prisma.paymentEntry.update({
        where: { id: request.entryId },
        data:  { status: "CANCELLED" },
      }),
    ]);

    await logActivity({
      organizationId: context.org.id,
      userId:    context.user.id,
      userName:  context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug:    "payment",
      subAppSlug: "payment-approvals",
      featureKey: "payment.approval.cancelled",
      action:     "payment.approval.cancelled",
      actionLabel: `Cancelou pedido de aprovação "${request.entry.description}"`,
      resource:    request.entry.description,
      resourceId:  request.id,
      metadata: { entryId: request.entryId, reason: input.reason ?? null },
    });

    return { success: true };
  });

// ── Governance config (manage thresholds, payable required, reminder hours) ─

export const getPaymentGovernanceConfig = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Get payment governance config", tags: ["Payment"] })
  .input(z.object({}))
  .output(z.object({
    config: z.object({
      autoApprovalThresholdCents: z.number().nullable(),
      payableRequiresApproval:    z.boolean(),
      notifyApproversAfterHours:  z.number(),
    }),
  }))
  .handler(async ({ context }) => {
    const config = await prisma.paymentGovernanceConfig.findUnique({
      where: { organizationId: context.org.id },
      select: {
        autoApprovalThresholdCents: true,
        payableRequiresApproval:    true,
        notifyApproversAfterHours:  true,
      },
    });
    return {
      config: config ?? {
        autoApprovalThresholdCents: null,
        payableRequiresApproval:    false,
        notifyApproversAfterHours:  24,
      },
    };
  });

export const updatePaymentGovernanceConfig = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Upsert payment governance config", tags: ["Payment"] })
  .input(z.object({
    autoApprovalThresholdCents: z.number().nullable(),
    payableRequiresApproval:    z.boolean(),
    notifyApproversAfterHours:  z.number().min(1).max(168), // 1h até 1 semana
  }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    // Só owner/master configura governança (mudança crítica de regra global).
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { role: true },
    });
    if (member?.role !== "owner") {
      throw new ORPCError("FORBIDDEN", {
        message: "Apenas o Master pode configurar a governança financeira",
      });
    }

    await prisma.paymentGovernanceConfig.upsert({
      where:  { organizationId: context.org.id },
      create: {
        organizationId:             context.org.id,
        autoApprovalThresholdCents: input.autoApprovalThresholdCents,
        payableRequiresApproval:    input.payableRequiresApproval,
        notifyApproversAfterHours:  input.notifyApproversAfterHours,
      },
      update: {
        autoApprovalThresholdCents: input.autoApprovalThresholdCents,
        payableRequiresApproval:    input.payableRequiresApproval,
        notifyApproversAfterHours:  input.notifyApproversAfterHours,
      },
    });

    await logActivity({
      organizationId: context.org.id,
      userId:    context.user.id,
      userName:  context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug:    "payment",
      subAppSlug: "payment-governance",
      featureKey: "payment.governance.config_updated",
      action:     "payment.governance.config_updated",
      actionLabel: "Atualizou configuração de governança financeira",
      resource:   "payment-governance",
      metadata:   input,
    });

    return { success: true };
  });
