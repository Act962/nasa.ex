import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroConfirmationLine } from "@/features/astro/lib/astro-confirmation";
import { createPendingAction } from "@/features/astro/server/tools/_shared/proposals/create-proposal";
import { findPossibleDuplicateEntries } from "@/features/payment/server/documents/find-duplicate-entries";
import { formatBrazilianDocument } from "@/features/payment/lib/documents/normalize-document";
import { assertPaymentToolAccess } from "./access";
import { resolveDateIso } from "./dates";
import { FINANCE_ACTION_TYPES, type CreateEntryProposalPayload } from "./executors";
import { ENTRY_STATUS_LABELS, formatBRL, formatDateBR } from "./payloads";

// Proposta de lançamento novo (spec 0014, RF-3/RF-10): monta o card de
// confirmação e só grava depois do "sim", pelo executor `payment.entry.create`.

const newContactSchema = z.object({
  name: z.string().min(1).max(120),
  document: z.string().optional().describe("CNPJ/CPF, só dígitos."),
  email: z.string().optional(),
  phone: z.string().optional(),
  contactType: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]).optional(),
});

const proposeEntryInput = z.object({
  type: z.enum(["RECEIVABLE", "PAYABLE"]).describe("PAYABLE = conta a pagar/despesa. RECEIVABLE = a receber/receita."),
  amountCents: z.number().int().min(1).describe("Valor em CENTAVOS (R$ 1.250,50 → 125050)."),
  description: z.string().min(1).max(120),
  dueDateIso: z.string().optional().describe("Vencimento AAAA-MM-DD ('hoje'/'amanhã' aceitos). Default: hoje."),
  status: z.enum(["PENDING", "PAID"]).optional().describe("PAID quando o usuário disse que já pagou/recebeu. Default PENDING."),
  paidAtIso: z.string().optional().describe("Data do pagamento quando status=PAID. Default: hoje."),
  categoryId: z.string().optional(),
  contactId: z.string().optional().describe("ID de PaymentContact existente (de list_payment_contacts ou contactMatch)."),
  newContact: newContactSchema.optional().describe("Cadastra o contato na confirmação quando não existe. Não use junto com contactId."),
  accountId: z.string().optional(),
  documentNumber: z.string().optional(),
  notes: z.string().optional(),
  attachmentId: z.string().optional().describe("Anexo lido por read_financial_document — será vinculado e renomeado."),
  installments: z
    .array(z.object({ dueDateIso: z.string(), amountCents: z.number().int().min(1) }))
    .optional()
    .describe("Parcelas explícitas (ex.: duplicatas de NF). Quando presente, amountCents é o total e cada parcela vira um lançamento."),
});

export function buildEntryProposalTools(ctx: AgentContext) {
  async function proposeEntry(input: z.infer<typeof proposeEntryInput>) {
    const access = await assertPaymentToolAccess(ctx, "entries", "create");
    if (!access.ok) return { error: access.error };

    const dueDate = resolveDateIso(input.dueDateIso);
    if (typeof dueDate !== "string") return dueDate;
    const paidAt = input.status === "PAID" ? resolveDateIso(input.paidAtIso) : undefined;
    if (paidAt && typeof paidAt !== "string") return paidAt;

    const warnings: string[] = [];
    const lines: AstroConfirmationLine[] = [];

    const [category, contact, account, attachment] = await Promise.all([
      input.categoryId
        ? prisma.paymentCategory.findFirst({
            where: { id: input.categoryId, organizationId: ctx.organizationId },
            select: { id: true, name: true },
          })
        : null,
      input.contactId
        ? prisma.paymentContact.findFirst({
            where: { id: input.contactId, organizationId: ctx.organizationId },
            select: { id: true, name: true, document: true },
          })
        : null,
      input.accountId
        ? prisma.paymentBankAccount.findFirst({
            where: { id: input.accountId, organizationId: ctx.organizationId },
            select: { id: true, name: true },
          })
        : null,
      input.attachmentId
        ? prisma.paymentAttachment.findFirst({
            where: { id: input.attachmentId, organizationId: ctx.organizationId },
            select: { id: true, fileName: true, entryId: true },
          })
        : null,
    ]);

    if (input.categoryId && !category) {
      return { error: `categoryId "${input.categoryId}" não é uma categoria desta organização. Use list_payment_categories.` };
    }
    if (input.contactId && !contact) {
      return { error: `contactId "${input.contactId}" não é um contato desta organização. Use list_payment_contacts ou passe newContact.` };
    }
    if (input.accountId && !account) {
      return { error: `accountId "${input.accountId}" não é uma conta desta organização. Use list_payment_accounts.` };
    }
    if (input.attachmentId && !attachment) {
      return { error: `Anexo "${input.attachmentId}" não encontrado nesta organização.` };
    }
    if (attachment?.entryId) {
      warnings.push("Este documento já está vinculado a outro lançamento.");
    }

    const installments = input.installments?.map((installment) => {
      const resolved = resolveDateIso(installment.dueDateIso);
      return { dueDate: typeof resolved === "string" ? resolved : dueDate, amountCents: installment.amountCents };
    });
    if (installments && installments.length > 0) {
      const sum = installments.reduce((total, installment) => total + installment.amountCents, 0);
      if (sum !== input.amountCents) {
        warnings.push(`A soma das parcelas (${formatBRL(sum)}) difere do total (${formatBRL(input.amountCents)}).`);
      }
    }

    const duplicates = await findPossibleDuplicateEntries({
      organizationId: ctx.organizationId,
      documentNumber: input.documentNumber ?? null,
      amountCents: input.amountCents,
      dueDate,
    });
    for (const duplicate of duplicates) {
      warnings.push(
        `Possível duplicado: "${duplicate.description}" de ${formatBRL(duplicate.amountCents)} vencendo ${formatDateBR(duplicate.dueDate)} (${ENTRY_STATUS_LABELS[duplicate.status] ?? duplicate.status}).`,
      );
    }

    lines.push({ label: "Tipo", value: input.type === "PAYABLE" ? "Conta a pagar" : "Conta a receber" });
    lines.push({ label: "Descrição", value: input.description });
    lines.push({ label: "Valor", value: formatBRL(input.amountCents) });
    if (installments && installments.length > 1) {
      lines.push({
        label: "Parcelas",
        value: installments
          .map((installment, index) => `${index + 1}) ${formatDateBR(installment.dueDate)} · ${formatBRL(installment.amountCents)}`)
          .join(" | "),
      });
    } else {
      lines.push({ label: "Vencimento", value: formatDateBR(dueDate) });
    }
    lines.push({
      label: "Status",
      value: input.status === "PAID" ? `Já ${input.type === "PAYABLE" ? "pago" : "recebido"} em ${formatDateBR(paidAt as string)}` : "Em aberto",
    });
    if (contact) {
      lines.push({
        label: input.type === "PAYABLE" ? "Fornecedor" : "Cliente",
        value: contact.document ? `${contact.name} (${formatBrazilianDocument(contact.document)})` : contact.name,
      });
    } else if (input.newContact) {
      lines.push({
        label: input.type === "PAYABLE" ? "Fornecedor (novo)" : "Cliente (novo)",
        value: input.newContact.document
          ? `${input.newContact.name} (${formatBrazilianDocument(input.newContact.document)})`
          : input.newContact.name,
      });
    }
    if (category) lines.push({ label: "Categoria", value: category.name });
    if (account) lines.push({ label: "Conta", value: account.name });
    if (input.documentNumber) lines.push({ label: "Documento", value: input.documentNumber });
    if (attachment) lines.push({ label: "Anexo", value: attachment.fileName });
    if (input.notes) lines.push({ label: "Observações", value: input.notes });

    const payload: CreateEntryProposalPayload = {
      type: input.type,
      amountCents: input.amountCents,
      description: input.description,
      dueDate,
      status: input.status ?? "PENDING",
      paidAt: typeof paidAt === "string" ? paidAt : undefined,
      categoryId: category?.id,
      contactId: contact?.id,
      newContact: contact ? undefined : input.newContact,
      accountId: account?.id,
      documentNumber: input.documentNumber,
      notes: input.notes,
      attachmentId: attachment?.id,
      installments,
    };

    return createPendingAction({
      ctx,
      actionType: FINANCE_ACTION_TYPES.createEntry,
      payload: payload as unknown as Record<string, unknown>,
      title: input.type === "PAYABLE" ? "Lançar conta a pagar" : "Lançar conta a receber",
      lines,
      warnings,
    });
  }

  return {
    propose_payment_entry: tool({
      description:
        "PROPÕE um lançamento financeiro (conta a pagar ou a receber). Nada é gravado até o usuário confirmar — a tool devolve um card de confirmação. Use pra 'lança esse boleto', 'insira despesa de R$ 100', 'recebi 500 do cliente X', ou depois de read_financial_document. Passe attachmentId pra vincular e renomear o documento. Se o contato não existe, passe newContact.",
      inputSchema: proposeEntryInput,
      execute: proposeEntry,
    }),

    create_payment_entry: tool({
      description:
        "Apelido de propose_payment_entry (mantido por compatibilidade). Também só PROPÕE — nada é gravado sem confirmação. 'gastei/paguei' → type=PAYABLE, status=PAID; 'recebi' → RECEIVABLE, status=PAID; 'tenho que pagar dia X' → status=PENDING.",
      inputSchema: z.object({
        type: z.enum(["RECEIVABLE", "PAYABLE"]),
        amountCents: z.number().int().min(1),
        description: z.string().min(1).max(120),
        notes: z.string().optional(),
        dueDateIso: z.string().optional(),
        status: z.enum(["PENDING", "PAID"]).optional().describe("Default PAID (frases no passado: gastei/recebi)."),
        categoryId: z.string().optional(),
        contactId: z.string().optional(),
      }),
      execute: async (input) =>
        proposeEntry({
          type: input.type,
          amountCents: input.amountCents,
          description: input.description,
          notes: input.notes,
          dueDateIso: input.dueDateIso,
          status: input.status ?? "PAID",
          categoryId: input.categoryId,
          contactId: input.contactId,
        }),
    }),
  };
}
