import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroTablePayload } from "@/features/astro/lib/astro-table";
import { queryPaymentEntries } from "@/features/payment/server/entries/query-entries";
import { ATTACHMENT_KIND_LABELS, PAYMENT_ATTACHMENT_KINDS } from "@/features/payment/lib/attachments";
import { assertPaymentToolAccess } from "./access";
import { buildEntriesTable, formatBRL } from "./payloads";

// Tools financeiras de LISTAGEM (spec 0014, RF-2): lançamentos, vencidos,
// categorias, contatos, contas e documentos. Devolvem tabelas renderizáveis.

export function buildFinanceListTools(ctx: AgentContext) {
  return {
    list_payment_entries: tool({
      description:
        "TABELA de lançamentos financeiros com filtros: tipo (RECEIVABLE/PAYABLE), status, categorias, contatos, contas, vencimento (fromIso/toIso), valor mín/máx, busca por texto. Também devolve totais do filtro. Use pra 'lista despesas', 'receitas do mês', 'pagamentos acima de R$ 500', 'pendentes do fornecedor X'.",
      inputSchema: z.object({
        type: z.enum(["RECEIVABLE", "PAYABLE"]).optional().describe("RECEIVABLE = receita, PAYABLE = despesa. Sem isso, ambos."),
        statuses: z
          .array(z.enum(["PENDING_APPROVAL", "PENDING", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"]))
          .optional(),
        categoryIds: z.array(z.string()).optional(),
        contactIds: z.array(z.string()).optional().describe("IDs de PaymentContact."),
        accountIds: z.array(z.string()).optional().describe("IDs de PaymentBankAccount."),
        fromIso: z.string().optional().describe("Vencimento ≥ (AAAA-MM-DD)."),
        toIso: z.string().optional().describe("Vencimento ≤ (AAAA-MM-DD)."),
        amountMinCents: z.number().int().min(0).optional(),
        amountMaxCents: z.number().int().min(0).optional(),
        search: z.string().optional().describe("Busca em descrição, documento, notas, contato e categoria."),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async (input) => {
        const access = await assertPaymentToolAccess(ctx, "entries", "view");
        if (!access.ok) return { error: access.error };
        const result = await queryPaymentEntries({
          organizationId: ctx.organizationId,
          type: input.type,
          statuses: input.statuses,
          categoryIds: input.categoryIds,
          contactIds: input.contactIds,
          accountIds: input.accountIds,
          dateFrom: input.fromIso,
          dateTo: input.toIso,
          amountMinCents: input.amountMinCents,
          amountMaxCents: input.amountMaxCents,
          search: input.search,
          perPage: input.limit ?? 20,
          orderBy: "dueDate_desc",
        });
        const title =
          input.type === "PAYABLE" ? "Despesas" : input.type === "RECEIVABLE" ? "Receitas" : "Lançamentos financeiros";
        return {
          ...buildEntriesTable({
            title,
            caption: `${result.total} lançamento(s) · total ${formatBRL(result.totals.amount)} · pendente ${formatBRL(result.totals.pendingAmount)}`,
            totalCount: result.total,
            entries: result.entries,
          }),
          totals: result.totals,
        };
      },
    }),

    list_overdue_entries: tool({
      description:
        "TABELA dos lançamentos VENCIDOS (status OVERDUE) — atrasados a pagar e/ou a receber, com total. Use pra 'o que está vencido', 'atrasados', 'inadimplentes', 'quem me deve'.",
      inputSchema: z.object({
        type: z.enum(["RECEIVABLE", "PAYABLE"]).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async (input) => {
        const access = await assertPaymentToolAccess(ctx, "entries", "view");
        if (!access.ok) return { error: access.error };
        const result = await queryPaymentEntries({
          organizationId: ctx.organizationId,
          type: input.type,
          statuses: ["OVERDUE"],
          perPage: input.limit ?? 20,
          orderBy: "dueDate_asc",
        });
        return {
          ...buildEntriesTable({
            title: input.type === "RECEIVABLE" ? "Recebimentos atrasados" : input.type === "PAYABLE" ? "Pagamentos atrasados" : "Lançamentos vencidos",
            caption: `${result.total} vencido(s) · ${formatBRL(result.totals.amount)}`,
            totalCount: result.total,
            entries: result.entries,
          }),
          totals: result.totals,
        };
      },
    }),

    list_payment_categories: tool({
      description:
        "TABELA das categorias financeiras da org (REVENUE/EXPENSE/COST). Use pra escolher categoryId numa proposta ou quando o user pedir 'minhas categorias'.",
      inputSchema: z.object({
        type: z.enum(["REVENUE", "EXPENSE", "COST"]).optional(),
      }),
      execute: async ({ type }) => {
        const access = await assertPaymentToolAccess(ctx, "categories", "view");
        if (!access.ok) return { error: access.error };
        const categories = await prisma.paymentCategory.findMany({
          where: { organizationId: ctx.organizationId, isActive: true, ...(type ? { type } : {}) },
          select: { id: true, name: true, color: true, type: true },
          orderBy: [{ type: "asc" }, { name: "asc" }],
          take: 100,
        });
        const typeLabel: Record<string, string> = { REVENUE: "Receita", EXPENSE: "Despesa", COST: "Custo" };
        const table: AstroTablePayload = {
          kind: "astro_table",
          entityType: "user",
          title: "Categorias financeiras",
          caption: `${categories.length} categoria(s)${type ? ` do tipo ${typeLabel[type] ?? type}` : ""}`,
          totalCount: categories.length,
          columns: [
            { key: "name", label: "Nome" },
            { key: "type", label: "Tipo", type: "badge" },
          ],
          rows: categories.map((category) => ({
            id: category.id,
            name: category.name,
            type: typeLabel[category.type] ?? category.type,
          })),
        };
        return { ...table, categories };
      },
    }),

    list_payment_contacts: tool({
      description:
        "Fornecedores e clientes do financeiro (PaymentContact) com id, documento, e-mail e telefone. Use pra resolver 'fornecedor X' em contactId antes de propor lançamento, ou quando o user pedir 'meus fornecedores'.",
      inputSchema: z.object({
        search: z.string().optional().describe("Nome, CNPJ/CPF, e-mail ou telefone."),
        contactType: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async (input) => {
        const access = await assertPaymentToolAccess(ctx, "contacts", "view");
        if (!access.ok) return { error: access.error };
        const contacts = await prisma.paymentContact.findMany({
          where: {
            organizationId: ctx.organizationId,
            isActive: true,
            ...(input.contactType ? { contactType: input.contactType } : {}),
            ...(input.search
              ? {
                  OR: [
                    { name: { contains: input.search, mode: "insensitive" } },
                    { document: { contains: input.search.replace(/\D/g, "") || input.search } },
                    { email: { contains: input.search, mode: "insensitive" } },
                    { phone: { contains: input.search } },
                  ],
                }
              : {}),
          },
          select: { id: true, name: true, document: true, email: true, phone: true, contactType: true },
          orderBy: { name: "asc" },
          take: input.limit ?? 20,
        });
        return { contacts };
      },
    }),

    list_payment_accounts: tool({
      description:
        "Contas bancárias do financeiro (PaymentBankAccount) com saldo. Use pra resolver accountId numa baixa ou quando o user pedir 'saldo por conta'.",
      inputSchema: z.object({}),
      execute: async () => {
        const access = await assertPaymentToolAccess(ctx, "accounts", "view");
        if (!access.ok) return { error: access.error };
        const accounts = await prisma.paymentBankAccount.findMany({
          where: { organizationId: ctx.organizationId, isActive: true },
          select: { id: true, name: true, bankName: true, type: true, balance: true, isDefault: true },
          orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        });
        return {
          accounts: accounts.map((account) => ({
            ...account,
            balanceCents: account.balance,
            balanceFormatted: formatBRL(account.balance),
          })),
        };
      },
    }),

    list_payment_documents: tool({
      description:
        "TABELA dos documentos financeiros salvos (Documentos do /payment): nome, tipo (boleto, NF, recibo...), lançamento vinculado e se já foi lido pelo Astro. Use pra 'boletos salvos', 'documentos sem lançamento', 'acha a NF 1234'.",
      inputSchema: z.object({
        search: z.string().optional(),
        kind: z.enum(PAYMENT_ATTACHMENT_KINDS).optional(),
        unlinkedOnly: z.boolean().optional().describe("Só documentos sem lançamento vinculado."),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async (input) => {
        const access = await assertPaymentToolAccess(ctx, "entries", "view");
        if (!access.ok) return { error: access.error };
        const attachments = await prisma.paymentAttachment.findMany({
          where: {
            organizationId: ctx.organizationId,
            ...(input.kind ? { kind: input.kind } : {}),
            ...(input.unlinkedOnly ? { entryId: null } : {}),
            ...(input.search
              ? {
                  OR: [
                    { fileName: { contains: input.search, mode: "insensitive" } },
                    { originalFileName: { contains: input.search, mode: "insensitive" } },
                    { description: { contains: input.search, mode: "insensitive" } },
                    { entry: { description: { contains: input.search, mode: "insensitive" } } },
                  ],
                }
              : {}),
          },
          select: {
            id: true,
            fileName: true,
            kind: true,
            createdAt: true,
            extractedAt: true,
            entry: { select: { id: true, description: true, amount: true, dueDate: true } },
          },
          orderBy: { createdAt: "desc" },
          take: input.limit ?? 20,
        });
        const table: AstroTablePayload = {
          kind: "astro_table",
          entityType: "user",
          title: "Documentos financeiros",
          caption: `${attachments.length} documento(s)`,
          totalCount: attachments.length,
          columns: [
            { key: "fileName", label: "Arquivo" },
            { key: "kindLabel", label: "Tipo", type: "badge" },
            { key: "entry", label: "Lançamento" },
            { key: "createdAt", label: "Enviado em", type: "date" },
            { key: "read", label: "Lido pelo Astro" },
          ],
          rows: attachments.map((attachment) => ({
            id: attachment.id,
            fileName: attachment.fileName,
            kindLabel: ATTACHMENT_KIND_LABELS[attachment.kind] ?? attachment.kind,
            entry: attachment.entry
              ? `${attachment.entry.description} (${formatBRL(attachment.entry.amount)})`
              : "Sem vínculo",
            createdAt: attachment.createdAt.toISOString(),
            read: attachment.extractedAt ? "Sim" : "Não",
          })),
        };
        return {
          ...table,
          documents: attachments.map((attachment) => ({
            attachmentId: attachment.id,
            fileName: attachment.fileName,
            kind: attachment.kind,
            entryId: attachment.entry?.id ?? null,
            alreadyRead: Boolean(attachment.extractedAt),
          })),
        };
      },
    }),
  };
}
