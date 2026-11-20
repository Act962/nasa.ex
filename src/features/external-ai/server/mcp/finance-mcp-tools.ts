import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import prisma from "@/lib/prisma";
import { takeRateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { isValidDateValue } from "@/features/payment/lib/dates";
import { PAYMENT_ACTIONS, PAYMENT_RESOURCES, type PaymentAction, type PaymentResource } from "@/features/payment/lib/permissions";
import {
  isPaymentActionAllowed,
  resolvePaymentPermissions,
  type ResolvedPaymentPermissions,
} from "@/features/payment/server/access/resolve-payment-permissions";
import { loadSettledMovementsByAccount, withComputedBalance } from "@/features/payment/server/accounts/settled-movements";
import { loadCashflow } from "@/features/payment/server/cashflow/load-cashflow";
import { loadPaymentDashboard } from "@/features/payment/server/dashboard/load-dashboard";
import { createPaymentEntryRecord } from "@/features/payment/server/entries/create-entry";
import { formatCents } from "@/features/payment/server/entries/entry-include";
import { queryPaymentEntries } from "@/features/payment/server/entries/query-entries";
import { loadPaymentProjection } from "@/features/payment/server/projection/load-projection";
import { loadIncomeStatement, loadOperationalResult } from "@/features/payment/server/reports/load-reports";
import { FINANCE_SCOPE, type ExternalAiCaller } from "../access-tokens";
import { asResult, type ToolResult } from "./trafego-mcp-tools";

// Financeiro pelo MCP (spec 0144): a IA da pessoa lê e lança com as permissões que ela tem no Financeiro. Nada que mova dinheiro.

const RATE_LIMIT = { max: 300, windowMs: 60 * 60 * 1000 };
const ENTRIES_LIMIT = 100;
const CONTACTS_LIMIT = 50;
const CATEGORIES_LIMIT = 200;
const NO_ACCESS = "Você não tem acesso ao Financeiro desta empresa (ou ela não existe).";

const ENTRY_TYPES = ["RECEIVABLE", "PAYABLE"] as const;
const ENTRY_STATUSES = ["PENDING_APPROVAL", "PENDING", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"] as const;
const CATEGORY_TYPES = ["REVENUE", "EXPENSE", "COST"] as const;
const CONTACT_TYPES = ["CUSTOMER", "SUPPLIER", "BOTH"] as const;

const asError = (message: string): ToolResult => ({ content: [{ type: "text", text: message }], isError: true });

type FinanceActor = { id: string; name: string; email: string; image: string | null };

/** O app aparece para quem tem acesso autorizado ou é dono de empresa (o dono ganha o acesso sozinho). Só lê (RNF-4). */
export async function hasAnyFinanceAccess(userId: string): Promise<boolean> {
  const [access, ownership] = await Promise.all([
    prisma.paymentAccess.findFirst({ where: { userId, isAuthorized: true }, select: { id: true } }),
    prisma.member.findFirst({ where: { userId, role: "owner" }, select: { id: true } }),
  ]);
  return access !== null || ownership !== null;
}

async function loadActor(caller: ExternalAiCaller): Promise<FinanceActor> {
  return prisma.user.findUniqueOrThrow({ where: { id: caller.userId }, select: { id: true, name: true, email: true, image: true } });
}

/** Mesma matriz do `requirePaymentAccess` da tela (RF-2). Na chave, só as empresas gravadas nela. */
async function loadPermissions(caller: ExternalAiCaller, organizationId: string): Promise<ResolvedPaymentPermissions | null> {
  if (caller.credential === "key" && !caller.organizationIds.includes(organizationId)) return null;
  const isMember = await prisma.member.findFirst({ where: { userId: caller.userId, organizationId }, select: { id: true } });
  if (!isMember) return null;
  return resolvePaymentPermissions(await loadActor(caller), organizationId);
}

async function assertFinanceAccess(caller: ExternalAiCaller, organizationId: string, resource: PaymentResource, action: PaymentAction) {
  const permissions = await loadPermissions(caller, organizationId);
  if (!permissions) throw new Error(NO_ACCESS);
  if (!isPaymentActionAllowed(permissions, resource, action)) {
    throw new Error(`Seu papel no Financeiro (${permissions.role}) não permite ${action === "view" ? "ver" : "criar"} ${RESOURCE_LABEL[resource]}.`);
  }
}

const RESOURCE_LABEL: Record<PaymentResource, string> = {
  dashboard: "o painel e os relatórios",
  entries: "lançamentos",
  accounts: "contas bancárias",
  categories: "categorias",
  contacts: "contatos",
  settings: "configurações",
};

/** Data `AAAA-MM-DD`, como a tela (RF-7). */
function assertDate(value: string | undefined, field: string) {
  if (value !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !isValidDateValue(value))) {
    throw new Error(`Data inválida em ${field}: use AAAA-MM-DD, ex.: 2026-11-20.`);
  }
}

async function assertSameOrganization(organizationId: string, references: { categoryId?: string; accountId?: string; contactId?: string; parentId?: string }) {
  const [category, account, contact, parent] = await Promise.all([
    references.categoryId ? prisma.paymentCategory.findFirst({ where: { id: references.categoryId, organizationId }, select: { id: true } }) : null,
    references.accountId ? prisma.paymentBankAccount.findFirst({ where: { id: references.accountId, organizationId }, select: { id: true } }) : null,
    references.contactId ? prisma.paymentContact.findFirst({ where: { id: references.contactId, organizationId }, select: { id: true } }) : null,
    references.parentId ? prisma.paymentCategory.findFirst({ where: { id: references.parentId, organizationId }, select: { id: true } }) : null,
  ]);
  const missing = [
    references.categoryId && !category ? "categoryId" : null,
    references.accountId && !account ? "accountId" : null,
    references.contactId && !contact ? "contactId" : null,
    references.parentId && !parent ? "parentId" : null,
  ].filter(Boolean);
  if (missing.length > 0) throw new Error(`Não encontrado nesta empresa: ${missing.join(", ")}. Use os ids de finance_list_categories, finance_list_accounts e finance_list_contacts.`);
}

const toDay = (date: Date | null | undefined) => (date ? date.toISOString().slice(0, 10) : null);

async function runFinanceTool(caller: ExternalAiCaller, work: () => Promise<unknown>): Promise<ToolResult> {
  try {
    if (!caller.scopes.includes(FINANCE_SCOPE)) {
      return asError("Esta chave não tem acesso ao Financeiro. Gere uma chave nova em Satélites › IA externa ou conecte pelo OAuth.");
    }
    const limit = takeRateLimit("mcp-finance", `${caller.userId}:${caller.tokenId}`, RATE_LIMIT);
    if (!limit.allowed) return asError(`Muitas chamadas seguidas. Tente de novo em ${Math.ceil(limit.retryAfterSeconds / 60)} min.`);
    return asResult(await work());
  } catch (error) {
    return asError(error instanceof Error ? error.message : "Erro inesperado.");
  }
}

const organizationIdInput = z.string().describe("Id da empresa (de finance_list_organizations)");
const dayInput = (description: string) => z.string().describe(`${description} (AAAA-MM-DD)`);
const periodInput = {
  organizationId: organizationIdInput,
  dateFrom: dayInput("Início do período").optional(),
  dateTo: dayInput("Fim do período").optional(),
  categoryIds: z.array(z.string()).max(50).optional(),
};
const regimeInput = z.enum(["cash", "accrual"]).optional().describe("cash = o que entrou e saiu de fato (padrão); accrual = competência");

export function registerFinanceMcpTools(server: McpServer, caller: ExternalAiCaller) {
  server.registerTool(
    "finance_list_organizations",
    {
      description: "Empresas em que você tem o Financeiro, com o seu papel e o que pode ver e criar em cada uma. Comece por aqui.",
      inputSchema: {},
    },
    () =>
      runFinanceTool(caller, async () => {
        const memberships = await prisma.member.findMany({
          where: { userId: caller.userId, ...(caller.credential === "key" ? { organizationId: { in: caller.organizationIds } } : {}) },
          select: { organization: { select: { id: true, name: true } } },
        });
        const organizations = await Promise.all(
          memberships.map(async ({ organization }) => {
            const permissions = await loadPermissions(caller, organization.id);
            if (!permissions) return null;
            const allowed = Object.fromEntries(
              PAYMENT_RESOURCES.filter((resource) => resource !== "settings").map((resource) => [
                resource,
                PAYMENT_ACTIONS.filter((action) => (action === "view" || action === "create") && isPaymentActionAllowed(permissions, resource, action)),
              ]),
            );
            return { organizationId: organization.id, name: organization.name, role: permissions.role, allowed };
          }),
        );
        return organizations.filter((organization) => organization !== null);
      }),
  );

  server.registerTool(
    "finance_list_entries",
    {
      description: `Lançamentos (contas a pagar e a receber) com filtros e os totais do filtro, até ${ENTRIES_LIMIT}. Para vencidos use statuses ["OVERDUE"]. Valores em centavos.`,
      inputSchema: {
        organizationId: organizationIdInput,
        type: z.enum(ENTRY_TYPES).optional().describe("RECEIVABLE = a receber, PAYABLE = a pagar"),
        statuses: z.array(z.enum(ENTRY_STATUSES)).optional(),
        dueFrom: dayInput("Vencimento a partir de").optional(),
        dueTo: dayInput("Vencimento até").optional(),
        paidFrom: dayInput("Pago a partir de").optional(),
        paidTo: dayInput("Pago até").optional(),
        amountMinCents: z.number().int().min(0).optional(),
        amountMaxCents: z.number().int().min(0).optional(),
        categoryIds: z.array(z.string()).max(50).optional(),
        contactIds: z.array(z.string()).max(50).optional(),
        accountIds: z.array(z.string()).max(50).optional(),
        search: z.string().max(200).optional().describe("Descrição, documento, observação, contato ou categoria"),
        orderBy: z.enum(["dueDate_asc", "dueDate_desc", "amount_asc", "amount_desc"]).optional(),
        limit: z.number().int().min(1).max(ENTRIES_LIMIT).optional(),
      },
    },
    (input) =>
      runFinanceTool(caller, async () => {
        await assertFinanceAccess(caller, input.organizationId, "entries", "view");
        for (const [field, value] of Object.entries({ dueFrom: input.dueFrom, dueTo: input.dueTo, paidFrom: input.paidFrom, paidTo: input.paidTo })) assertDate(value, field);
        const result = await queryPaymentEntries({
          organizationId: input.organizationId,
          type: input.type,
          statuses: input.statuses,
          dateFrom: input.dueFrom,
          dateTo: input.dueTo,
          paidFrom: input.paidFrom,
          paidTo: input.paidTo,
          amountMinCents: input.amountMinCents,
          amountMaxCents: input.amountMaxCents,
          categoryIds: input.categoryIds,
          contactIds: input.contactIds,
          accountIds: input.accountIds,
          search: input.search,
          perPage: input.limit ?? 30,
          orderBy: input.orderBy ?? "dueDate_asc",
        });
        return {
          total: result.total,
          totals: result.totals,
          entries: result.entries.map((entry) => ({
            entryId: entry.id,
            type: entry.type,
            status: entry.status,
            description: entry.description,
            amountCents: entry.amount,
            paidAmountCents: entry.paidAmount,
            amount: formatCents(entry.amount),
            dueDate: toDay(entry.dueDate),
            paidAt: toDay(entry.paidAt),
            installment: entry.installmentTotal ? `${entry.installmentCurrent}/${entry.installmentTotal}` : null,
            category: entry.category ? { id: entry.category.id, name: entry.category.name } : null,
            contact: entry.contact ? { id: entry.contact.id, name: entry.contact.name } : null,
            account: entry.account ? { id: entry.account.id, name: entry.account.name } : null,
            documentNumber: entry.documentNumber,
          })),
        };
      }),
  );

  server.registerTool(
    "finance_get_dashboard",
    {
      description: "Painel do período (padrão: mês atual): a receber, a pagar, recebido, pago, vencidos, saldo nas contas, resultado, próximos 7 e 30 dias e por categoria. Os mesmos números do Painel em /payment. Valores em centavos.",
      inputSchema: { ...periodInput, month: z.number().int().min(1).max(12).optional(), year: z.number().int().min(2000).max(2100).optional() },
    },
    (input) =>
      runFinanceTool(caller, async () => {
        await assertFinanceAccess(caller, input.organizationId, "dashboard", "view");
        assertDate(input.dateFrom, "dateFrom");
        assertDate(input.dateTo, "dateTo");
        const summary = await loadPaymentDashboard({
          organizationId: input.organizationId,
          month: input.month,
          year: input.year,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
          categoryIds: input.categoryIds,
        });
        const upcoming = (entries: typeof summary.upcomingPayables) =>
          entries.map((entry) => ({ entryId: entry.id, description: entry.description, contactName: entry.contactName, amountCents: entry.amount, dueDate: toDay(entry.dueDate) }));
        return {
          period: { from: toDay(summary.period.start), to: toDay(summary.period.end) },
          totals: {
            receivableOpenCents: summary.totalReceivable,
            payableOpenCents: summary.totalPayable,
            receivedCents: summary.totalReceived,
            paidCents: summary.totalPaid,
            overdueReceivableCents: summary.overdueReceivable,
            overduePayableCents: summary.overduePayable,
            bankBalanceCents: summary.balanceTotal,
            netResultCents: summary.netResult,
          },
          formatted: {
            receivableOpen: formatCents(summary.totalReceivable),
            payableOpen: formatCents(summary.totalPayable),
            received: formatCents(summary.totalReceived),
            paid: formatCents(summary.totalPaid),
            bankBalance: formatCents(summary.balanceTotal),
            netResult: formatCents(summary.netResult),
          },
          upcoming7Days: summary.upcoming7Days,
          upcoming30Days: summary.upcoming30Days,
          previousPeriod: summary.previousPeriod,
          categoryBreakdown: summary.categoryBreakdown,
          upcomingPayables: upcoming(summary.upcomingPayables),
          upcomingReceivables: upcoming(summary.upcomingReceivables),
        };
      }),
  );

  server.registerTool(
    "finance_get_cashflow",
    {
      description: "Fluxo de caixa por dia do período (padrão: mês atual): entradas, saídas e saldo acumulado, em centavos.",
      inputSchema: { ...periodInput, month: z.number().int().min(1).max(12).optional(), year: z.number().int().min(2000).max(2100).optional() },
    },
    (input) =>
      runFinanceTool(caller, async () => {
        await assertFinanceAccess(caller, input.organizationId, "dashboard", "view");
        assertDate(input.dateFrom, "dateFrom");
        assertDate(input.dateTo, "dateTo");
        const { rows, period } = await loadCashflow({
          organizationId: input.organizationId,
          month: input.month,
          year: input.year,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
          categoryIds: input.categoryIds,
        });
        return { period: { from: toDay(period.start), to: toDay(period.end) }, days: rows };
      }),
  );

  server.registerTool(
    "finance_get_income_statement",
    {
      description: "DRE do período (padrão: mês atual): receita, custos, despesas, lucro bruto, resultado e margens, por categoria. Valores em centavos.",
      inputSchema: { ...periodInput, regime: regimeInput },
    },
    (input) =>
      runFinanceTool(caller, async () => {
        await assertFinanceAccess(caller, input.organizationId, "dashboard", "view");
        assertDate(input.dateFrom, "dateFrom");
        assertDate(input.dateTo, "dateTo");
        const statement = await loadIncomeStatement({
          organizationId: input.organizationId,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
          regime: input.regime,
          categoryIds: input.categoryIds,
        });
        return { ...statement, period: { from: toDay(statement.period.start), to: toDay(statement.period.end) } };
      }),
  );

  server.registerTool(
    "finance_get_operational_result",
    {
      description: "DRO do período: receita, despesas, resultado e margem de cada centro de custo. Valores em centavos.",
      inputSchema: { ...periodInput, regime: regimeInput },
    },
    (input) =>
      runFinanceTool(caller, async () => {
        await assertFinanceAccess(caller, input.organizationId, "dashboard", "view");
        assertDate(input.dateFrom, "dateFrom");
        assertDate(input.dateTo, "dateTo");
        const result = await loadOperationalResult({
          organizationId: input.organizationId,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
          regime: input.regime,
          categoryIds: input.categoryIds,
        });
        return { ...result, period: { from: toDay(result.period.start), to: toDay(result.period.end) } };
      }),
  );

  server.registerTool(
    "finance_get_projection",
    {
      description: "Projeção de caixa dos próximos 3, 6 ou 12 meses: saldo inicial, comprometido e estimado por mês, saldo projetado. Valores em centavos.",
      inputSchema: {
        organizationId: organizationIdInput,
        horizonMonths: z.union([z.literal(3), z.literal(6), z.literal(12)]).optional(),
        categoryIds: z.array(z.string()).max(50).optional(),
      },
    },
    (input) =>
      runFinanceTool(caller, async () => {
        await assertFinanceAccess(caller, input.organizationId, "dashboard", "view");
        return loadPaymentProjection({ organizationId: input.organizationId, horizonMonths: input.horizonMonths, categoryIds: input.categoryIds });
      }),
  );

  server.registerTool(
    "finance_list_accounts",
    {
      description: "Contas bancárias ativas. balanceCents é o saldo da tela (saldo inicial + baixas registradas); openingBalanceCents é só o inicial.",
      inputSchema: { organizationId: organizationIdInput },
    },
    ({ organizationId }) =>
      runFinanceTool(caller, async () => {
        await assertFinanceAccess(caller, organizationId, "accounts", "view");
        const [accounts, movements] = await Promise.all([
          prisma.paymentBankAccount.findMany({
            where: { organizationId, isActive: true },
            select: { id: true, name: true, bankName: true, type: true, balance: true, isDefault: true },
            orderBy: [{ isDefault: "desc" }, { name: "asc" }],
          }),
          loadSettledMovementsByAccount(organizationId),
        ]);
        return accounts.map((account) => {
          const computed = withComputedBalance(account, movements);
          return {
            accountId: account.id,
            name: account.name,
            bankName: account.bankName,
            type: account.type,
            isDefault: account.isDefault,
            balanceCents: computed.computedBalance,
            balance: formatCents(computed.computedBalance),
            openingBalanceCents: account.balance,
          };
        });
      }),
  );

  server.registerTool(
    "finance_list_categories",
    {
      description: "Categorias ativas (REVENUE = receita, EXPENSE = despesa, COST = custo), com a categoria-mãe.",
      inputSchema: { organizationId: organizationIdInput, type: z.enum(CATEGORY_TYPES).optional() },
    },
    ({ organizationId, type }) =>
      runFinanceTool(caller, async () => {
        await assertFinanceAccess(caller, organizationId, "categories", "view");
        const categories = await prisma.paymentCategory.findMany({
          where: { organizationId, isActive: true, ...(type ? { type } : {}) },
          select: { id: true, name: true, type: true, parentId: true },
          orderBy: [{ type: "asc" }, { name: "asc" }],
          take: CATEGORIES_LIMIT,
        });
        return categories.map((category) => ({ categoryId: category.id, name: category.name, type: category.type, parentId: category.parentId }));
      }),
  );

  server.registerTool(
    "finance_list_contacts",
    {
      description: `Clientes e fornecedores do Financeiro, até ${CONTACTS_LIMIT}. Busque antes de criar um contato novo.`,
      inputSchema: {
        organizationId: organizationIdInput,
        search: z.string().max(200).optional().describe("Nome, CPF/CNPJ, e-mail ou telefone"),
        contactType: z.enum(CONTACT_TYPES).optional(),
      },
    },
    ({ organizationId, search, contactType }) =>
      runFinanceTool(caller, async () => {
        await assertFinanceAccess(caller, organizationId, "contacts", "view");
        const digits = search?.replace(/\D/g, "");
        const contacts = await prisma.paymentContact.findMany({
          where: {
            organizationId,
            isActive: true,
            ...(contactType ? { contactType } : {}),
            ...(search
              ? {
                  OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { document: { contains: digits || search } },
                    { email: { contains: search, mode: "insensitive" } },
                    { phone: { contains: digits || search } },
                  ],
                }
              : {}),
          },
          select: { id: true, name: true, document: true, email: true, phone: true, contactType: true },
          orderBy: { name: "asc" },
          take: CONTACTS_LIMIT,
        });
        return contacts.map(({ id, ...contact }) => ({ contactId: id, ...contact }));
      }),
  );

  server.registerTool(
    "finance_create_entry",
    {
      description:
        "Lança uma conta a pagar (PAYABLE) ou a receber (RECEIVABLE), pendente. Com installments > 1, cria uma parcela por mês a partir do vencimento. Se a empresa exige aprovação acima de um valor, nasce aguardando aprovação. Mostre ao usuário o que vai lançar e espere a confirmação antes. Não dá baixa.",
      inputSchema: {
        organizationId: organizationIdInput,
        type: z.enum(ENTRY_TYPES),
        description: z.string().trim().min(1).max(300),
        amountCents: z.number().int().positive().max(100_000_000_00).describe("Valor de cada parcela em centavos (R$ 2.500,00 = 250000)"),
        dueDate: dayInput("Vencimento (da primeira parcela)"),
        competenceDate: dayInput("Competência").optional(),
        categoryId: z.string().optional(),
        contactId: z.string().optional(),
        accountId: z.string().optional(),
        documentNumber: z.string().max(100).optional(),
        notes: z.string().max(2000).optional(),
        installments: z.number().int().min(1).max(12).optional(),
        requiresApproval: z.boolean().optional().describe("Pedir aprovação mesmo abaixo do limite da empresa"),
      },
    },
    (input) =>
      runFinanceTool(caller, async () => {
        await assertFinanceAccess(caller, input.organizationId, "entries", "create");
        assertDate(input.dueDate, "dueDate");
        assertDate(input.competenceDate, "competenceDate");
        await assertSameOrganization(input.organizationId, { categoryId: input.categoryId, accountId: input.accountId, contactId: input.contactId });
        const entries = await createPaymentEntryRecord({
          organizationId: input.organizationId,
          actor: await loadActor(caller),
          input: {
            type: input.type,
            description: input.description,
            amount: input.amountCents,
            dueDate: input.dueDate,
            competenceDate: input.competenceDate,
            categoryId: input.categoryId,
            contactId: input.contactId,
            accountId: input.accountId,
            documentNumber: input.documentNumber,
            notes: input.notes ? `${input.notes}\n\n(lançado via ${caller.label})` : `Lançado via ${caller.label}`,
            installments: input.installments ?? 1,
            requiresApproval: input.requiresApproval ?? false,
          },
        });
        return {
          entries: entries.map((entry) => ({
            entryId: entry.id,
            status: entry.status,
            description: entry.description,
            amount: formatCents(entry.amount),
            dueDate: toDay(entry.dueDate),
            installment: entry.installmentTotal ? `${entry.installmentCurrent}/${entry.installmentTotal}` : null,
          })),
          openPath: "/payment",
        };
      }),
  );

  server.registerTool(
    "finance_create_category",
    {
      description: "Cria uma categoria do Financeiro. Confira antes em finance_list_categories se ela já existe.",
      inputSchema: {
        organizationId: organizationIdInput,
        name: z.string().trim().min(1).max(100),
        type: z.enum(CATEGORY_TYPES),
        parentId: z.string().optional().describe("Categoria-mãe, se for subcategoria"),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      },
    },
    (input) =>
      runFinanceTool(caller, async () => {
        await assertFinanceAccess(caller, input.organizationId, "categories", "create");
        await assertSameOrganization(input.organizationId, { parentId: input.parentId });
        const category = await prisma.paymentCategory.create({
          data: { organizationId: input.organizationId, name: input.name, type: input.type, parentId: input.parentId, ...(input.color ? { color: input.color } : {}) },
          select: { id: true, name: true, type: true, parentId: true },
        });
        await logFinanceActivity(caller, input.organizationId, { action: "payment.category.created", label: `Criou a categoria "${category.name}"`, resourceId: category.id, resource: category.name });
        return { categoryId: category.id, name: category.name, type: category.type, parentId: category.parentId };
      }),
  );

  server.registerTool(
    "finance_create_contact",
    {
      description: "Cria um cliente ou fornecedor do Financeiro. Busque antes em finance_list_contacts para não duplicar.",
      inputSchema: {
        organizationId: organizationIdInput,
        name: z.string().trim().min(1).max(200),
        contactType: z.enum(CONTACT_TYPES).optional().describe("Padrão: BOTH"),
        document: z.string().max(20).optional().describe("CPF ou CNPJ"),
        email: z.string().email().max(200).optional(),
        phone: z.string().max(30).optional(),
        notes: z.string().max(2000).optional(),
      },
    },
    (input) =>
      runFinanceTool(caller, async () => {
        await assertFinanceAccess(caller, input.organizationId, "contacts", "create");
        const contact = await prisma.paymentContact.create({
          data: {
            organizationId: input.organizationId,
            name: input.name,
            contactType: input.contactType ?? "BOTH",
            document: input.document,
            email: input.email,
            phone: input.phone,
            notes: input.notes,
          },
          select: { id: true, name: true, contactType: true, document: true },
        });
        await logFinanceActivity(caller, input.organizationId, { action: "payment.contact.created", label: `Criou o contato "${contact.name}"`, resourceId: contact.id, resource: contact.name });
        return { contactId: contact.id, name: contact.name, contactType: contact.contactType, document: contact.document };
      }),
  );
}

async function logFinanceActivity(caller: ExternalAiCaller, organizationId: string, params: { action: string; label: string; resource: string; resourceId: string }) {
  const actor = await loadActor(caller);
  await logActivity({
    organizationId,
    userId: actor.id,
    userName: actor.name,
    userEmail: actor.email,
    userImage: actor.image,
    appSlug: "payment",
    action: params.action,
    actionLabel: `${params.label} (via ${caller.label})`,
    resource: params.resource,
    resourceId: params.resourceId,
    metadata: { via: caller.label, credential: caller.credential },
  });
}
