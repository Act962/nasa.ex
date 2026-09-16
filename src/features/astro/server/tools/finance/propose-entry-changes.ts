import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroConfirmationLine } from "@/features/astro/lib/astro-confirmation";
import { createPendingAction } from "@/features/astro/server/tools/_shared/proposals/create-proposal";
import { assertPaymentToolAccess } from "./access";
import { resolveDateIso } from "./dates";
import {
  FINANCE_ACTION_TYPES,
  type PayEntryProposalPayload,
  type UpdateEntryProposalPayload,
} from "./executors";
import { formatBRL, formatDateBR } from "./payloads";

// Propostas sobre lançamentos existentes (spec 0014, RF-3/RF-10/RF-11):
// alterar e dar baixa passam por confirmação. `create_payment_category` mora
// aqui por ser a única escrita direta do pack — criar categoria é inócuo.

export function buildEntryChangeTools(ctx: AgentContext) {
  async function proposeUpdate(input: {
    entryId: string;
    description?: string;
    amountCents?: number;
    dueDateIso?: string;
    categoryId?: string | null;
    contactId?: string | null;
    accountId?: string | null;
    documentNumber?: string | null;
    notes?: string | null;
  }) {
    const access = await assertPaymentToolAccess(ctx, "entries", "edit");
    if (!access.ok) return { error: access.error };

    const entry = await prisma.paymentEntry.findFirst({
      where: { id: input.entryId, organizationId: ctx.organizationId },
      include: { category: { select: { name: true } }, contact: { select: { name: true } } },
    });
    if (!entry) return { error: "Lançamento não encontrado nesta organização." };

    const patch: UpdateEntryProposalPayload["patch"] = {};
    const lines: AstroConfirmationLine[] = [
      { label: "Lançamento", value: `${entry.description} · ${formatBRL(entry.amount)} · ${formatDateBR(entry.dueDate)}` },
    ];

    if (input.description !== undefined) {
      patch.description = input.description;
      lines.push({ label: "Descrição", value: `${entry.description} → ${input.description}` });
    }
    if (input.amountCents !== undefined) {
      patch.amount = input.amountCents;
      lines.push({ label: "Valor", value: `${formatBRL(entry.amount)} → ${formatBRL(input.amountCents)}` });
    }
    if (input.dueDateIso !== undefined) {
      const dueDate = resolveDateIso(input.dueDateIso);
      if (typeof dueDate !== "string") return dueDate;
      patch.dueDate = dueDate;
      lines.push({ label: "Vencimento", value: `${formatDateBR(entry.dueDate)} → ${formatDateBR(dueDate)}` });
    }
    if (input.categoryId !== undefined) {
      if (input.categoryId) {
        const category = await prisma.paymentCategory.findFirst({
          where: { id: input.categoryId, organizationId: ctx.organizationId },
          select: { name: true },
        });
        if (!category) return { error: `categoryId "${input.categoryId}" inválido. Use list_payment_categories.` };
        lines.push({ label: "Categoria", value: `${entry.category?.name ?? "—"} → ${category.name}` });
      } else {
        lines.push({ label: "Categoria", value: `${entry.category?.name ?? "—"} → (sem categoria)` });
      }
      patch.categoryId = input.categoryId;
    }
    if (input.contactId !== undefined) {
      if (input.contactId) {
        const contact = await prisma.paymentContact.findFirst({
          where: { id: input.contactId, organizationId: ctx.organizationId },
          select: { name: true },
        });
        if (!contact) return { error: `contactId "${input.contactId}" inválido. Use list_payment_contacts.` };
        lines.push({ label: "Contato", value: `${entry.contact?.name ?? "—"} → ${contact.name}` });
      } else {
        lines.push({ label: "Contato", value: `${entry.contact?.name ?? "—"} → (sem contato)` });
      }
      patch.contactId = input.contactId;
    }
    if (input.accountId !== undefined) {
      if (input.accountId) {
        const account = await prisma.paymentBankAccount.findFirst({
          where: { id: input.accountId, organizationId: ctx.organizationId },
          select: { name: true },
        });
        if (!account) return { error: `accountId "${input.accountId}" inválido. Use list_payment_accounts.` };
        lines.push({ label: "Conta", value: account.name });
      }
      patch.accountId = input.accountId;
    }
    if (input.documentNumber !== undefined) {
      patch.documentNumber = input.documentNumber;
      lines.push({ label: "Documento", value: input.documentNumber ?? "(vazio)" });
    }
    if (input.notes !== undefined) {
      patch.notes = input.notes;
      lines.push({ label: "Observações", value: input.notes ?? "(vazio)" });
    }

    if (Object.keys(patch).length === 0) {
      return { error: "Nada pra alterar — informe ao menos um campo." };
    }

    const payload: UpdateEntryProposalPayload = { entryId: entry.id, patch };
    return createPendingAction({
      ctx,
      actionType: FINANCE_ACTION_TYPES.updateEntry,
      payload: payload as unknown as Record<string, unknown>,
      title: "Alterar lançamento",
      lines,
    });
  }

  return {
    propose_update_payment_entry: tool({
      description:
        "PROPÕE alteração de um lançamento existente (descrição, valor, vencimento, categoria, contato, conta, documento, notas). Devolve card de confirmação. Pra dar baixa/pagar use propose_pay_entry.",
      inputSchema: z.object({
        entryId: z.string(),
        description: z.string().min(1).max(120).optional(),
        amountCents: z.number().int().min(1).optional(),
        dueDateIso: z.string().optional(),
        categoryId: z.string().nullable().optional().describe("ID de PaymentCategory. null remove."),
        contactId: z.string().nullable().optional().describe("ID de PaymentContact. null remove."),
        accountId: z.string().nullable().optional(),
        documentNumber: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
      execute: proposeUpdate,
    }),

    update_payment_entry: tool({
      description:
        "Apelido de propose_update_payment_entry (compatibilidade). Também só PROPÕE. categoryId = PaymentCategory; contactId = PaymentContact; accountId = PaymentBankAccount — nunca troque um pelo outro.",
      inputSchema: z.object({
        entryId: z.string(),
        categoryId: z.string().optional(),
        contactId: z.string().optional(),
        accountId: z.string().optional(),
        notes: z.string().optional(),
        description: z.string().optional(),
      }),
      execute: proposeUpdate,
    }),

    propose_pay_entry: tool({
      description:
        "PROPÕE a baixa (pagamento/recebimento) de um lançamento em aberto, total ou parcial. Devolve card de confirmação. Use pra 'paguei o boleto X', 'dá baixa na NF 123', 'recebi do cliente Y'.",
      inputSchema: z.object({
        entryId: z.string(),
        paidAmountCents: z.number().int().min(1).optional().describe("Default: o saldo devedor inteiro."),
        paidAtIso: z.string().optional().describe("Data do pagamento (AAAA-MM-DD). Default: hoje."),
        accountId: z.string().optional().describe("Conta bancária de onde saiu/entrou."),
      }),
      execute: async (input) => {
        const access = await assertPaymentToolAccess(ctx, "entries", "edit");
        if (!access.ok) return { error: access.error };

        const entry = await prisma.paymentEntry.findFirst({
          where: { id: input.entryId, organizationId: ctx.organizationId },
          include: { contact: { select: { name: true } } },
        });
        if (!entry) return { error: "Lançamento não encontrado nesta organização." };
        if (entry.status === "CANCELLED") return { error: "Lançamento cancelado não aceita baixa." };
        const remaining = entry.amount - entry.paidAmount;
        if (remaining <= 0) return { error: "Esse lançamento já está quitado." };

        const paidAmountCents = input.paidAmountCents ?? remaining;
        if (paidAmountCents > remaining) {
          return { error: `Valor acima do saldo devedor (${formatBRL(remaining)}).` };
        }
        const paidAt = resolveDateIso(input.paidAtIso);
        if (typeof paidAt !== "string") return paidAt;

        let accountName: string | null = null;
        if (input.accountId) {
          const account = await prisma.paymentBankAccount.findFirst({
            where: { id: input.accountId, organizationId: ctx.organizationId },
            select: { name: true },
          });
          if (!account) return { error: `accountId "${input.accountId}" inválido. Use list_payment_accounts.` };
          accountName = account.name;
        }

        const lines: AstroConfirmationLine[] = [
          { label: "Lançamento", value: `${entry.description}${entry.contact ? ` · ${entry.contact.name}` : ""}` },
          { label: "Valor original", value: formatBRL(entry.amount) },
          { label: paidAmountCents >= remaining ? "Baixa total" : "Baixa parcial", value: formatBRL(paidAmountCents) },
          { label: "Data", value: formatDateBR(paidAt) },
        ];
        if (accountName) lines.push({ label: "Conta", value: accountName });
        if (paidAmountCents < remaining) {
          lines.push({ label: "Restante após a baixa", value: formatBRL(remaining - paidAmountCents) });
        }

        const payload: PayEntryProposalPayload = {
          entryId: entry.id,
          paidAmountCents,
          paidAt,
          accountId: input.accountId,
        };
        return createPendingAction({
          ctx,
          actionType: FINANCE_ACTION_TYPES.payEntry,
          payload: payload as unknown as Record<string, unknown>,
          title: entry.type === "PAYABLE" ? "Registrar pagamento" : "Registrar recebimento",
          lines,
        });
      },
    }),

    create_payment_category: tool({
      description:
        "Cria uma categoria FINANCEIRA (PaymentCategory) direto — sem confirmação, é inócua. Tipo obrigatório: REVENUE (receita), EXPENSE (despesa), COST (custo). Use quando o usuário citar uma categoria que não existe em list_payment_categories.",
      inputSchema: z.object({
        name: z.string().min(1).max(60),
        type: z.enum(["REVENUE", "EXPENSE", "COST"]),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      }),
      execute: async ({ name, type, color }) => {
        const access = await assertPaymentToolAccess(ctx, "categories", "create");
        if (!access.ok) return { error: access.error };
        const existing = await prisma.paymentCategory.findFirst({
          where: { organizationId: ctx.organizationId, name: { equals: name, mode: "insensitive" }, type },
          select: { id: true, name: true, type: true },
        });
        if (existing) {
          return { success: true, categoryId: existing.id, summary: `Categoria "${existing.name}" já existia — usando ela.` };
        }
        const category = await prisma.paymentCategory.create({
          data: { name, type, color: color ?? "#1E90FF", organizationId: ctx.organizationId },
          select: { id: true, name: true, type: true },
        });
        const typeLabel = type === "EXPENSE" ? "despesa" : type === "REVENUE" ? "receita" : "custo";
        return { success: true, categoryId: category.id, summary: `Categoria "${category.name}" (${typeLabel}) criada.` };
      },
    }),
  };
}
