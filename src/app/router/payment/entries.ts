import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { randomUUID } from "crypto";

const entryShape = z.object({
  id: z.string(),
  organizationId: z.string(),
  type: z.enum(["RECEIVABLE", "PAYABLE"]),
  status: z.enum(["PENDING_APPROVAL", "PENDING", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"]),
  description: z.string(),
  amount: z.number(),
  paidAmount: z.number(),
  dueDate: z.date(),
  paidAt: z.date().nullable(),
  competenceDate: z.date().nullable(),
  documentNumber: z.string().nullable(),
  notes: z.string().nullable(),
  attachmentUrl: z.string().nullable(),
  categoryId: z.string().nullable(),
  costCenterId: z.string().nullable(),
  contactId: z.string().nullable(),
  accountId: z.string().nullable(),
  trackingId: z.string().nullable(),
  leadId: z.string().nullable(),
  installmentTotal: z.number().nullable(),
  installmentCurrent: z.number().nullable(),
  installmentGroupId: z.string().nullable(),
  isRecurring: z.boolean(),
  recurrenceType: z.string().nullable(),
  // Governança Fase 2
  requiresApproval: z.boolean(),
  approvalThresholdAmountCents: z.number().nullable(),
  // Régua de cobrança Fase 2
  dunningRuleId: z.string().nullable(),
  createdById: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  category: z.object({ id: z.string(), name: z.string(), type: z.string(), color: z.string().nullable() }).nullable(),
  contact: z.object({ id: z.string(), name: z.string(), contactType: z.string() }).nullable(),
  account: z.object({ id: z.string(), name: z.string(), type: z.string() }).nullable(),
  approvalRequest: z
    .object({
      id: z.string(),
      status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]),
      requestedById: z.string(),
      requestedAt: z.date(),
      decidedAt: z.date().nullable(),
    })
    .nullable(),
});

const entryInclude = {
  category: { select: { id: true, name: true, type: true, color: true } },
  contact: { select: { id: true, name: true, contactType: true } },
  account: { select: { id: true, name: true, type: true } },
  approvalRequest: {
    select: {
      id: true,
      status: true,
      requestedById: true,
      requestedAt: true,
      decidedAt: true,
    },
  },
};

export const listPaymentEntries = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "List payment entries", tags: ["Payment"] })
  .input(z.object({
    type: z.enum(["RECEIVABLE", "PAYABLE"]).optional(),
    status: z.enum(["PENDING_APPROVAL", "PENDING", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"]).optional(),
    contactId: z.string().optional(),
    categoryId: z.string().optional(),
    accountId: z.string().optional(),
    // Filtros novos pra histórico de orçamentos do lead no chat.
    leadId: z.string().optional(),
    trackingId: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    search: z.string().optional(),
    page: z.number().default(1),
    perPage: z.number().default(50),
  }))
  .output(z.object({
    entries: z.array(entryShape),
    total: z.number(),
  }))
  .handler(async ({ input, context, errors }) => {
    try {
      const where = {
        organizationId: context.org.id,
        ...(input.type ? { type: input.type } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.contactId ? { contactId: input.contactId } : {}),
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
        ...(input.accountId ? { accountId: input.accountId } : {}),
        ...(input.leadId ? { leadId: input.leadId } : {}),
        ...(input.trackingId ? { trackingId: input.trackingId } : {}),
        ...(input.search ? { description: { contains: input.search, mode: "insensitive" as const } } : {}),
        ...(input.dateFrom || input.dateTo
          ? {
              dueDate: {
                ...(input.dateFrom ? { gte: new Date(input.dateFrom) } : {}),
                ...(input.dateTo ? { lte: new Date(input.dateTo) } : {}),
              },
            }
          : {}),
      };
      const [entries, total] = await Promise.all([
        prisma.paymentEntry.findMany({
          where,
          include: entryInclude,
          orderBy: { dueDate: "asc" },
          skip: (input.page - 1) * input.perPage,
          take: input.perPage,
        }),
        prisma.paymentEntry.count({ where }),
      ]);
      return { entries, total };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const createPaymentEntry = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Create payment entry", tags: ["Payment"] })
  .input(z.object({
    type: z.enum(["RECEIVABLE", "PAYABLE"]),
    description: z.string(),
    amount: z.number(),
    dueDate: z.string(),
    categoryId: z.string().optional(),
    costCenterId: z.string().optional(),
    contactId: z.string().optional(),
    accountId: z.string().optional(),
    // Vínculos opcionais com tracking/lead — usado pela feature de
    // Orçamento (chat → "+") pra rastrear A receber por lead específico.
    trackingId: z.string().optional(),
    leadId: z.string().optional(),
    notes: z.string().optional(),
    documentNumber: z.string().optional(),
    competenceDate: z.string().optional(),
    installments: z.number().default(1),
    isRecurring: z.boolean().default(false),
    recurrenceType: z.string().optional(),
    // Chave S3/R2 do anexo original (PDF/imagem do orçamento) — preenchido
    // quando o usuário sobe um arquivo via "Adicione o Orçamento aqui" no
    // BudgetPanel. Permite ver/baixar o arquivo no histórico.
    attachmentUrl: z.string().optional(),
    // ── Governança Fase 2 ──────────────────────────────────────────────────
    // Toggle "Exigir aprovação" no form. Quando true (ou trigger automático
    // do PaymentGovernanceConfig), a entry nasce em PENDING_APPROVAL e cria
    // um PaymentApprovalRequest. Quando todas triggers falham, fluxo legado
    // segue intacto (status PENDING como antes).
    requiresApproval: z.boolean().default(false),
    // Régua de cobrança (Fase 2) — só faz sentido em RECEIVABLE.
    dunningRuleId: z.string().optional(),
  }))
  .output(z.object({ entries: z.array(entryShape) }))
  .handler(async ({ input, context, errors }) => {
    try {
      const { installments, dueDate, competenceDate, requiresApproval, dunningRuleId, ...rest } = input;
      const groupId = installments > 1 ? randomUUID() : undefined;
      const baseDate = new Date(dueDate);

      // ── Decide se cada parcela nasce em PENDING_APPROVAL ────────────────
      // O trigger considera a config global (PaymentGovernanceConfig) +
      // flag manual + valor da PARCELA (não o total). Snapshot do threshold
      // é gravado em `approvalThresholdAmountCents` pra preservar histórico.
      const { shouldTriggerApproval } = await import(
        "@/features/payment/server/approvals/should-trigger-approval"
      );

      const triggers = await Promise.all(
        Array.from({ length: installments }).map(() =>
          shouldTriggerApproval({
            organizationId: context.org.id,
            amountCents: input.amount,
            type: input.type,
            requiresApprovalManual: requiresApproval,
          }),
        ),
      );

      const data = Array.from({ length: installments }, (_, i) => {
        const due = new Date(baseDate);
        due.setMonth(due.getMonth() + i);
        const trigger = triggers[i];
        return {
          ...rest,
          organizationId: context.org.id,
          createdById: context.user.id,
          dueDate: due,
          competenceDate: competenceDate ? new Date(competenceDate) : null,
          installmentTotal: installments > 1 ? installments : null,
          installmentCurrent: installments > 1 ? i + 1 : null,
          installmentGroupId: groupId ?? null,
          // Status ramificado: triggered → PENDING_APPROVAL; senão default PENDING.
          status: trigger.triggered ? ("PENDING_APPROVAL" as const) : ("PENDING" as const),
          requiresApproval: trigger.triggered,
          approvalThresholdAmountCents: trigger.thresholdSnapshotCents,
          // Régua de cobrança só pra RECEIVABLE; ignorada silenciosamente em PAYABLE.
          dunningRuleId: input.type === "RECEIVABLE" ? (dunningRuleId ?? null) : null,
        };
      });

      const entries = await prisma.$transaction(
        data.map((d) => prisma.paymentEntry.create({ data: d, include: entryInclude }))
      );

      // ── Cria PaymentApprovalRequest pra cada parcela triggered ──────────
      // Notifica aprovadores AGORA + agenda reminder event-driven (sem cron).
      // try/catch isolado: se falhar, a entry continua existindo — o status
      // PENDING_APPROVAL preserva o histórico pra retry manual.
      const triggeredEntries = entries.filter(
        (e) => e.status === "PENDING_APPROVAL",
      );
      if (triggeredEntries.length > 0) {
        const [{ notifyApproversOfRequest }, { scheduleApprovalReminder }] = await Promise.all([
          import("@/features/payment/server/approvals/notify-approvers"),
          import("@/features/payment/server/dunning/schedule"),
        ]);
        // Lê config 1x (não dentro do loop) pra evitar N queries iguais.
        const governance = await prisma.paymentGovernanceConfig.findUnique({
          where:  { organizationId: context.org.id },
          select: { notifyApproversAfterHours: true },
        });
        const reminderHours = governance?.notifyApproversAfterHours ?? 24;

        await Promise.all(
          triggeredEntries.map(async (entry) => {
            try {
              const request = await prisma.paymentApprovalRequest.create({
                data: {
                  organizationId: entry.organizationId,
                  entryId: entry.id,
                  requestedById: context.user.id,
                },
              });
              await notifyApproversOfRequest({
                organizationId: entry.organizationId,
                requestId: request.id,
                entryId: entry.id,
                requestedById: context.user.id,
                amount: entry.amount,
                description: entry.description,
                type: entry.type,
              });
              // Agenda reminder (Inngest dorme até a hora). Self-reschedule
              // se ainda PENDING após disparo (até MAX_RETRIES no handler).
              await scheduleApprovalReminder({
                requestId:     request.id,
                organizationId: entry.organizationId,
                delayHours:    reminderHours,
                retryCount:    0,
              });
            } catch (err) {
              console.error(
                "[payment/entries create] approval request side-effect failed:",
                err,
              );
            }
          }),
        );
      }

      // ── Agenda eventos de dunning pra parcelas RECEIVABLE com régua ─────
      // 1 evento Inngest por step (com `ts: dueDate + daysOffset`). Inngest
      // dorme até o ts. Idempotência via dedup key + DB constraint no handler.
      const receivablesWithRule = entries.filter(
        (e) => e.type === "RECEIVABLE" && e.dunningRuleId,
      );
      if (receivablesWithRule.length > 0) {
        const { scheduleDunningForEntry } = await import(
          "@/features/payment/server/dunning/schedule"
        );
        await Promise.all(
          receivablesWithRule.map((entry) =>
            scheduleDunningForEntry(entry.id).catch((err) => {
              console.error("[payment/entries create] dunning schedule failed:", err);
            }),
          ),
        );
      }

      const totalAmount = entries.reduce((s, e) => s + e.amount, 0);
      await logActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "payment",
        subAppSlug: "payment-entries",
        featureKey: input.type === "RECEIVABLE" ? "payment.receivable.created" : "payment.payable.created",
        action: input.type === "RECEIVABLE" ? "payment.receivable.created" : "payment.payable.created",
        actionLabel: `${input.type === "RECEIVABLE" ? "Lançou recebimento" : "Lançou pagamento"} "${input.description}" (R$ ${totalAmount.toFixed(2)})`,
        resource: input.description,
        resourceId: entries[0]?.id,
        metadata: { amount: totalAmount, installments, type: input.type },
      });

      return { entries };
    } catch (err) {
      console.error("[payment/entries create]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const updatePaymentEntry = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "PATCH", summary: "Update payment entry", tags: ["Payment"] })
  .input(z.object({
    id: z.string(),
    description: z.string().optional(),
    amount: z.number().optional(),
    dueDate: z.string().optional(),
    status: z.enum(["PENDING_APPROVAL", "PENDING", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"]).optional(),
    paidAmount: z.number().optional(),
    paidAt: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    costCenterId: z.string().nullable().optional(),
    contactId: z.string().nullable().optional(),
    accountId: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    documentNumber: z.string().nullable().optional(),
  }))
  .output(z.object({ entry: entryShape }))
  .handler(async ({ input, context, errors }) => {
    try {
      const { id, dueDate, paidAt, ...data } = input;
      const entry = await prisma.paymentEntry.update({
        where: { id, organizationId: context.org.id },
        data: {
          ...data,
          ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
          ...(paidAt !== undefined ? { paidAt: paidAt ? new Date(paidAt) : null } : {}),
        },
        include: entryInclude,
      });
      return { entry };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const payPaymentEntry = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Pay payment entry", tags: ["Payment"] })
  .input(z.object({
    id: z.string(),
    paidAmount: z.number(),
    paidAt: z.string().optional(),
    accountId: z.string().optional(),
  }))
  .output(z.object({ entry: entryShape }))
  .handler(async ({ input, context, errors }) => {
    try {
      const existing = await prisma.paymentEntry.findFirst({
        where: { id: input.id, organizationId: context.org.id },
      });
      if (!existing) throw errors.NOT_FOUND;

      const newPaid = existing.paidAmount + input.paidAmount;
      const status = newPaid >= existing.amount ? "PAID" : "PARTIAL";

      const entry = await prisma.paymentEntry.update({
        where: { id: input.id },
        data: {
          paidAmount: newPaid,
          status,
          paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
          ...(input.accountId ? { accountId: input.accountId } : {}),
        },
        include: entryInclude,
      });

      await logActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "payment",
        subAppSlug: "payment-entries",
        featureKey: status === "PAID" ? "payment.entry.paid" : "payment.entry.partial",
        action: status === "PAID" ? "payment.entry.paid" : "payment.entry.partial",
        actionLabel: status === "PAID"
          ? `Quitou "${entry.description}" (R$ ${input.paidAmount.toFixed(2)})`
          : `Recebeu parcial em "${entry.description}" (R$ ${input.paidAmount.toFixed(2)})`,
        resource: entry.description,
        resourceId: entry.id,
        metadata: { paidAmount: input.paidAmount, totalPaid: newPaid, totalAmount: existing.amount, type: existing.type },
      });

      return { entry };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const deletePaymentEntry = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "DELETE", summary: "Delete payment entry", tags: ["Payment"] })
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      await prisma.paymentEntry.update({
        where: { id: input.id, organizationId: context.org.id },
        data: { status: "CANCELLED" },
      });
      return { ok: true };
    } catch {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
