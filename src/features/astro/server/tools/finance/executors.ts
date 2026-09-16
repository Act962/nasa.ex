import "server-only";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import {
  registerProposalExecutor,
  type ProposalExecutionResult,
} from "@/features/astro/server/tools/_shared/proposals/types";
import { createPaymentEntryRecord } from "@/features/payment/server/entries/create-entry";
import { payPaymentEntryRecord } from "@/features/payment/server/entries/pay-entry";
import { updatePaymentEntryRecord } from "@/features/payment/server/entries/update-entry";
import { parseCalendarDate } from "@/features/payment/lib/dates";
import { buildStandardAttachmentFileName } from "@/features/payment/lib/attachment-naming";
import { documentDigits } from "@/features/payment/lib/documents/normalize-document";
import type { StoredFinancialExtraction } from "@/features/payment/schemas/financial-document-extraction";
import { attachmentKindForDocumentType } from "@/features/payment/server/documents/extract-financial-document";
import { assertPaymentToolAccess } from "./access";
import { formatBRL, formatDateBR } from "./payloads";

// Executores das propostas financeiras (spec 0014, D-2). Rodam só depois do
// "sim" do usuário, via `confirm_action`, e reusam os mesmos serviços das
// procedures — o lançamento nasce igual ao criado pela tela.

export const FINANCE_ACTION_TYPES = {
  createEntry: "payment.entry.create",
  updateEntry: "payment.entry.update",
  payEntry: "payment.entry.pay",
} as const;

export interface CreateEntryProposalPayload {
  type: "RECEIVABLE" | "PAYABLE";
  amountCents: number;
  description: string;
  /** AAAA-MM-DD */
  dueDate: string;
  status: "PENDING" | "PAID";
  paidAt?: string;
  categoryId?: string;
  contactId?: string;
  newContact?: {
    name: string;
    document?: string;
    email?: string;
    phone?: string;
    contactType?: "CUSTOMER" | "SUPPLIER" | "BOTH";
  };
  accountId?: string;
  documentNumber?: string;
  notes?: string;
  attachmentId?: string;
  installments?: Array<{ dueDate: string; amountCents: number }>;
}

export interface UpdateEntryProposalPayload {
  entryId: string;
  patch: {
    description?: string;
    amount?: number;
    dueDate?: string;
    categoryId?: string | null;
    contactId?: string | null;
    accountId?: string | null;
    documentNumber?: string | null;
    notes?: string | null;
  };
}

export interface PayEntryProposalPayload {
  entryId: string;
  paidAmountCents: number;
  /** AAAA-MM-DD */
  paidAt: string;
  accountId?: string;
}

async function loadActor(ctx: AgentContext) {
  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { id: true, name: true, email: true, image: true },
  });
  return user ?? { id: ctx.userId, name: null, email: null, image: null };
}

function tabFor(type: "RECEIVABLE" | "PAYABLE") {
  return type === "PAYABLE" ? "payables" : "receivables";
}

async function resolveContactId(
  ctx: AgentContext,
  payload: CreateEntryProposalPayload,
): Promise<{ contactId: string | undefined; contactName: string | null; createdContact: boolean }> {
  if (payload.contactId) {
    const contact = await prisma.paymentContact.findFirst({
      where: { id: payload.contactId, organizationId: ctx.organizationId },
      select: { id: true, name: true },
    });
    return { contactId: contact?.id, contactName: contact?.name ?? null, createdContact: false };
  }
  if (!payload.newContact) return { contactId: undefined, contactName: null, createdContact: false };

  const document = documentDigits(payload.newContact.document);
  // Alguém pode ter cadastrado entre a proposta e a confirmação.
  if (document) {
    const existing = await prisma.paymentContact.findFirst({
      where: { organizationId: ctx.organizationId, document },
      select: { id: true, name: true },
    });
    if (existing) return { contactId: existing.id, contactName: existing.name, createdContact: false };
  }
  const created = await prisma.paymentContact.create({
    data: {
      organizationId: ctx.organizationId,
      name: payload.newContact.name,
      document,
      email: payload.newContact.email ?? null,
      phone: payload.newContact.phone ?? null,
      contactType: payload.newContact.contactType ?? (payload.type === "PAYABLE" ? "SUPPLIER" : "CUSTOMER"),
    },
    select: { id: true, name: true },
  });
  return { contactId: created.id, contactName: created.name, createdContact: true };
}

async function renameAttachment(params: {
  attachmentId: string;
  organizationId: string;
  type: "RECEIVABLE" | "PAYABLE";
  contactName: string | null;
  amountCents: number;
  dueDate: string;
  documentNumber?: string;
}) {
  const attachment = await prisma.paymentAttachment.findFirst({
    where: { id: params.attachmentId, organizationId: params.organizationId },
    select: { id: true, fileName: true, originalFileName: true, kind: true, extraction: true },
  });
  if (!attachment) return null;

  const extraction = attachment.extraction as StoredFinancialExtraction | null;
  const kind =
    extraction?.documentType ? attachmentKindForDocumentType(extraction.documentType) : attachment.kind;
  const newFileName = buildStandardAttachmentFileName({
    referenceDate: parseCalendarDate(params.dueDate),
    kind: kind === "OUTRO" ? attachment.kind : kind,
    contactName: params.contactName,
    amountCents: params.amountCents,
    documentNumber: params.documentNumber ?? extraction?.documentNumber ?? null,
    originalFileName: attachment.originalFileName ?? attachment.fileName,
  });

  await prisma.paymentAttachment.update({
    where: { id: attachment.id },
    data: {
      fileName: newFileName,
      originalFileName: attachment.originalFileName ?? attachment.fileName,
      ...(kind !== "OUTRO" ? { kind } : {}),
    },
  });
  return newFileName;
}

registerProposalExecutor<CreateEntryProposalPayload>(
  FINANCE_ACTION_TYPES.createEntry,
  async ({ ctx, payload }): Promise<ProposalExecutionResult> => {
    const access = await assertPaymentToolAccess(ctx, "entries", "create");
    if (!access.ok) return { ok: false, summary: access.error };

    const actor = await loadActor(ctx);
    const { contactId, contactName, createdContact } = await resolveContactId(ctx, payload);

    const plannedInstallments =
      payload.installments && payload.installments.length > 0
        ? payload.installments
        : [{ dueDate: payload.dueDate, amountCents: payload.amountCents }];
    const totalCount = plannedInstallments.length;

    const createdEntries = [];
    for (const [index, installment] of plannedInstallments.entries()) {
      const entries = await createPaymentEntryRecord({
        organizationId: ctx.organizationId,
        actor,
        input: {
          type: payload.type,
          description:
            totalCount > 1 ? `${payload.description} (${index + 1}/${totalCount})` : payload.description,
          amount: installment.amountCents,
          dueDate: installment.dueDate,
          categoryId: payload.categoryId,
          contactId,
          accountId: payload.accountId,
          notes: payload.notes,
          documentNumber: payload.documentNumber,
          installments: 1,
          // O anexo vai só na primeira parcela; as demais apontam pelo grupo de descrição.
          attachmentIds: index === 0 && payload.attachmentId ? [payload.attachmentId] : undefined,
        },
      });
      createdEntries.push(...entries);
    }

    if (payload.status === "PAID") {
      for (const entry of createdEntries) {
        if (entry.status !== "PENDING") continue;
        await payPaymentEntryRecord({
          organizationId: ctx.organizationId,
          actor,
          entryId: entry.id,
          paidAmountCents: entry.amount,
          paidAt: payload.paidAt ? `${payload.paidAt}T12:00:00.000Z` : undefined,
          accountId: payload.accountId,
        });
      }
    }

    let renamedTo: string | null = null;
    if (payload.attachmentId) {
      try {
        renamedTo = await renameAttachment({
          attachmentId: payload.attachmentId,
          organizationId: ctx.organizationId,
          type: payload.type,
          contactName,
          amountCents: payload.amountCents,
          dueDate: payload.dueDate,
          documentNumber: payload.documentNumber,
        });
      } catch (error) {
        console.error("[astro/finance] rename attachment failed:", error);
      }
    }

    const first = createdEntries[0];
    if (payload.attachmentId && first) {
      // Documento vindo da caixa Gmail sai da fila (spec 0018, RF-6).
      await prisma.paymentInboxItem
        .updateMany({
          where: { organizationId: ctx.organizationId, attachmentId: payload.attachmentId },
          data: { status: "ACCEPTED", entryId: first.id },
        })
        .catch((error) => console.error("[astro/finance] inbox item accept failed:", error));
    }

    const awaitingApproval = createdEntries.some((entry) => entry.status === "PENDING_APPROVAL");
    const lines = [
      { label: "Lançamento", value: payload.description },
      { label: "Valor", value: formatBRL(payload.amountCents) },
      {
        label: totalCount > 1 ? "Parcelas" : "Vencimento",
        value: totalCount > 1 ? `${totalCount} parcelas` : formatDateBR(payload.dueDate),
      },
    ];
    if (contactName) lines.push({ label: "Contato", value: createdContact ? `${contactName} (cadastrado agora)` : contactName });
    if (renamedTo) lines.push({ label: "Documento salvo como", value: renamedTo });
    if (awaitingApproval) lines.push({ label: "Aprovação", value: "Aguardando aprovação pela governança" });

    return {
      ok: true,
      summary:
        `${payload.type === "PAYABLE" ? "Conta a pagar" : "Conta a receber"} lançada${payload.status === "PAID" ? " e baixada" : ""}` +
        (awaitingApproval ? " (aguardando aprovação)" : "") +
        ".",
      lines,
      links: [{ label: "Abrir no financeiro", href: `/payment?tab=${tabFor(payload.type)}` }],
      data: {
        entryIds: createdEntries.map((entry) => entry.id),
        contactId,
        createdContact,
        renamedTo,
        firstEntryId: first?.id,
      },
    };
  },
);

registerProposalExecutor<UpdateEntryProposalPayload>(
  FINANCE_ACTION_TYPES.updateEntry,
  async ({ ctx, payload }): Promise<ProposalExecutionResult> => {
    const access = await assertPaymentToolAccess(ctx, "entries", "edit");
    if (!access.ok) return { ok: false, summary: access.error };
    const result = await updatePaymentEntryRecord({
      organizationId: ctx.organizationId,
      entryId: payload.entryId,
      patch: payload.patch,
    });
    if (!result.ok) return { ok: false, summary: result.message };
    return {
      ok: true,
      summary: `Lançamento "${result.entry.description}" atualizado.`,
      links: [{ label: "Abrir no financeiro", href: `/payment?tab=${tabFor(result.entry.type)}` }],
      data: { entryId: result.entry.id },
    };
  },
);

registerProposalExecutor<PayEntryProposalPayload>(
  FINANCE_ACTION_TYPES.payEntry,
  async ({ ctx, payload }): Promise<ProposalExecutionResult> => {
    const access = await assertPaymentToolAccess(ctx, "entries", "edit");
    if (!access.ok) return { ok: false, summary: access.error };
    const actor = await loadActor(ctx);
    const result = await payPaymentEntryRecord({
      organizationId: ctx.organizationId,
      actor,
      entryId: payload.entryId,
      paidAmountCents: payload.paidAmountCents,
      paidAt: `${payload.paidAt}T12:00:00.000Z`,
      accountId: payload.accountId,
    });
    if (!result.ok) return { ok: false, summary: result.message };
    const remaining = result.entry.amount - result.entry.paidAmount;
    return {
      ok: true,
      summary:
        result.status === "PAID"
          ? `"${result.entry.description}" quitado (${formatBRL(payload.paidAmountCents)}).`
          : `Baixa parcial de ${formatBRL(payload.paidAmountCents)} em "${result.entry.description}" — restam ${formatBRL(remaining)}.`,
      links: [{ label: "Abrir no financeiro", href: `/payment?tab=${tabFor(result.entry.type)}` }],
      data: { entryId: result.entry.id, status: result.status },
    };
  },
);
