import "server-only";

import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { addCalendarMonths, parseCalendarDate } from "@/features/payment/lib/dates";
import { shouldTriggerApproval } from "@/features/payment/server/approvals/should-trigger-approval";
import { ENTRY_INCLUDE, type PaymentActor } from "./entry-include";

// Criação de lançamento (com parcelas, aprovação, régua e anexos) como serviço.
// A transação só grava; todos os efeitos rodam depois do commit, best-effort —
// um efeito que falhe não pode invalidar um lançamento já persistido (regra 18).

export interface CreatePaymentEntryInput {
  type: "RECEIVABLE" | "PAYABLE";
  description: string;
  /** Centavos, sempre positivo. */
  amount: number;
  /** "AAAA-MM-DD" (meio-dia UTC via `parseCalendarDate`). */
  dueDate: string;
  categoryId?: string;
  costCenterId?: string;
  contactId?: string;
  accountId?: string;
  trackingId?: string;
  leadId?: string;
  notes?: string;
  documentNumber?: string;
  competenceDate?: string;
  installments?: number;
  isRecurring?: boolean;
  recurrenceType?: string;
  attachmentUrl?: string;
  requiresApproval?: boolean;
  dunningRuleId?: string;
  attachmentIds?: string[];
}

export async function createPaymentEntryRecord(params: {
  organizationId: string;
  actor: PaymentActor;
  input: CreatePaymentEntryInput;
}) {
  const { organizationId, actor, input } = params;
  const installments = input.installments ?? 1;
  const groupId = installments > 1 ? randomUUID() : undefined;
  const baseDate = parseCalendarDate(input.dueDate);

  // Decide se cada parcela nasce em PENDING_APPROVAL: config global + flag
  // manual + valor da PARCELA. O threshold é gravado como snapshot.
  const triggers = await Promise.all(
    Array.from({ length: installments }).map(() =>
      shouldTriggerApproval({
        organizationId,
        amountCents: input.amount,
        type: input.type,
        requiresApprovalManual: input.requiresApproval ?? false,
      }),
    ),
  );

  const rows = Array.from({ length: installments }, (_, index) => {
    const trigger = triggers[index];
    return {
      type: input.type,
      description: input.description,
      amount: input.amount,
      categoryId: input.categoryId,
      costCenterId: input.costCenterId,
      contactId: input.contactId,
      accountId: input.accountId,
      trackingId: input.trackingId,
      leadId: input.leadId,
      notes: input.notes,
      documentNumber: input.documentNumber,
      isRecurring: input.isRecurring ?? false,
      recurrenceType: input.recurrenceType,
      attachmentUrl: input.attachmentUrl,
      organizationId,
      createdById: actor.id,
      dueDate: addCalendarMonths(baseDate, index),
      competenceDate: input.competenceDate ? parseCalendarDate(input.competenceDate) : null,
      installmentTotal: installments > 1 ? installments : null,
      installmentCurrent: installments > 1 ? index + 1 : null,
      installmentGroupId: groupId ?? null,
      status: trigger.triggered ? ("PENDING_APPROVAL" as const) : ("PENDING" as const),
      requiresApproval: trigger.triggered,
      approvalThresholdAmountCents: trigger.thresholdSnapshotCents,
      // Régua de cobrança só pra RECEIVABLE; ignorada silenciosamente em PAYABLE.
      dunningRuleId: input.type === "RECEIVABLE" ? (input.dunningRuleId ?? null) : null,
    };
  });

  const entries = await prisma.$transaction(
    rows.map((row) => prisma.paymentEntry.create({ data: row, include: ENTRY_INCLUDE })),
  );

  await runPostCreateEffects({ organizationId, actor, input, entries, installments });

  return entries;
}

type CreatedEntry = Awaited<ReturnType<typeof createPaymentEntryRecord>>[number];

async function runPostCreateEffects(params: {
  organizationId: string;
  actor: PaymentActor;
  input: CreatePaymentEntryInput;
  entries: CreatedEntry[];
  installments: number;
}) {
  const { organizationId, actor, input, entries, installments } = params;

  if (input.attachmentIds && input.attachmentIds.length > 0) {
    try {
      const { linkAttachmentsToEntries } = await import(
        "@/features/payment/server/attachments/link-attachments-to-entries"
      );
      await linkAttachmentsToEntries({
        organizationId,
        attachmentIds: input.attachmentIds,
        entryIds: entries.map((entry) => entry.id),
      });
    } catch (error) {
      console.error("[payment/entries create] attachment link failed:", error);
    }
  }

  const triggeredEntries = entries.filter((entry) => entry.status === "PENDING_APPROVAL");
  if (triggeredEntries.length > 0) {
    const [{ notifyApproversOfRequest }, { scheduleApprovalReminder }] = await Promise.all([
      import("@/features/payment/server/approvals/notify-approvers"),
      import("@/features/payment/server/dunning/schedule"),
    ]);
    const governance = await prisma.paymentGovernanceConfig.findUnique({
      where: { organizationId },
      select: { notifyApproversAfterHours: true },
    });
    const reminderHours = governance?.notifyApproversAfterHours ?? 24;

    await Promise.all(
      triggeredEntries.map(async (entry) => {
        try {
          const request = await prisma.paymentApprovalRequest.create({
            data: { organizationId, entryId: entry.id, requestedById: actor.id },
          });
          await notifyApproversOfRequest({
            organizationId,
            requestId: request.id,
            entryId: entry.id,
            requestedById: actor.id,
            amount: entry.amount,
            description: entry.description,
            type: entry.type,
          });
          await scheduleApprovalReminder({
            requestId: request.id,
            organizationId,
            delayHours: reminderHours,
            retryCount: 0,
          });
        } catch (error) {
          console.error("[payment/entries create] approval request side-effect failed:", error);
        }
      }),
    );
  }

  const receivablesWithRule = entries.filter(
    (entry) => entry.type === "RECEIVABLE" && entry.dunningRuleId,
  );
  if (receivablesWithRule.length > 0) {
    const { scheduleDunningForEntry } = await import("@/features/payment/server/dunning/schedule");
    await Promise.all(
      receivablesWithRule.map((entry) =>
        scheduleDunningForEntry(entry.id).catch((error) => {
          console.error("[payment/entries create] dunning schedule failed:", error);
        }),
      ),
    );
  }

  try {
    const { checkExpenseBreaksReserve } = await import(
      "@/features/payment/server/goals/check-expense-impact"
    );
    await checkExpenseBreaksReserve({
      organizationId,
      entries: entries.map((entry) => ({
        amount: entry.amount,
        dueDate: entry.dueDate,
        type: entry.type,
        status: entry.status,
      })),
    });
  } catch (error) {
    console.error("[payment/entries create] reserve check failed:", error);
  }

  const totalAmount = entries.reduce((sum, entry) => sum + entry.amount, 0);
  await logActivity({
    organizationId,
    userId: actor.id,
    userName: actor.name ?? "",
    userEmail: actor.email ?? "",
    userImage: actor.image,
    appSlug: "payment",
    subAppSlug: "payment-entries",
    featureKey: input.type === "RECEIVABLE" ? "payment.receivable.created" : "payment.payable.created",
    action: input.type === "RECEIVABLE" ? "payment.receivable.created" : "payment.payable.created",
    actionLabel: `${input.type === "RECEIVABLE" ? "Lançou recebimento" : "Lançou pagamento"} "${input.description}" (R$ ${totalAmount.toFixed(2)})`,
    resource: input.description,
    resourceId: entries[0]?.id,
    metadata: { amount: totalAmount, installments, type: input.type },
  });
}
