import "server-only";
import prisma from "@/lib/prisma";
import type { FinancialEntryStatus } from "@/generated/prisma/client";
import {
  ASKS,
  createdWithin,
  money,
  periodFrom,
  plural,
  startOfMonth,
  startOfToday,
  type AstroQuery,
} from "./types";

// Consultas dos demais apps — chat, forge, formulários, workspaces,
// financeiro e páginas. Um arquivo só porque cada app tem poucas perguntas
// de rotina; quando um crescer, ele ganha o seu.

const unreadConversations: AstroQuery = {
  key: "chat.unread",
  app: "chat",
  appKey: "chat",
  matches: (text) =>
    /\bconversas?|mensagens?|whatsapp\b/.test(text) &&
    /\bnao lidas?|sem ler|pendentes?|quantas|quantos\b/.test(text) &&
    !/\bhoje|ontem|semana|mes\b/.test(text),
  run: async ({ ctx }) => {
    const unread = await prisma.message.count({
      where: {
        seen: false,
        fromMe: false,
        conversation: { tracking: { organizationId: ctx.organizationId } },
      },
    });
    const conversations = await prisma.conversation.count({
      where: {
        tracking: { organizationId: ctx.organizationId },
        messages: { some: { seen: false, fromMe: false } },
      },
    });
    if (unread === 0) return { text: "Nenhuma mensagem sem ler." };
    return {
      text:
        `${unread} ${plural(unread, "mensagem sem ler", "mensagens sem ler")} ` +
        `em ${conversations} ${plural(conversations, "conversa", "conversas")}.`,
    };
  },
};

const messagesToday: AstroQuery = {
  key: "chat.messages_today",
  app: "chat",
  appKey: "chat",
  matches: (text) => /\bmensagens?\b/.test(text) && periodFrom(text) !== null,
  run: async ({ ctx, text }) => {
    const period = periodFrom(text)!;
    const where = {
      createdAt: { gte: period.since, lt: period.until },
      conversation: { tracking: { organizationId: ctx.organizationId } },
    };
    const [received, sent] = await Promise.all([
      prisma.message.count({ where: { ...where, fromMe: false } }),
      prisma.message.count({ where: { ...where, fromMe: true } }),
    ]);
    return {
      text: `${period.label[0].toUpperCase()}${period.label.slice(1)}: ${received} ${plural(received, "mensagem recebida", "mensagens recebidas")} e ${sent} ${plural(sent, "enviada", "enviadas")}.`,
    };
  },
};

const proposals: AstroQuery = {
  key: "forge.proposals",
  app: "forge",
  appKey: "forge",
  matches: (text) => ASKS.test(text) && /\bpropostas?|orcamentos?\b/.test(text),
  run: async ({ ctx, text }) => {
    const period = periodFrom(text);
    const grouped = await prisma.forgeProposal.groupBy({
      by: ["status"],
      where: { organizationId: ctx.organizationId, ...createdWithin(period) },
      _count: { _all: true },
    });
    if (grouped.length === 0) {
      return { text: period ? `Nenhuma proposta criada ${period.label}.` : "Nenhuma proposta criada ainda." };
    }
    const total = grouped.reduce((sum, row) => sum + row._count._all, 0);
    const LABEL: Record<string, string> = {
      RASCUNHO: "Rascunho",
      ENVIADA: "Enviada",
      VISUALIZADA: "Visualizada",
      PAGA: "Paga",
      EXPIRADA: "Expirada",
      CANCELADA: "Cancelada",
    };
    return {
      text: `${total} ${plural(total, "proposta", "propostas")}${period ? ` ${period.label}` : ""}, por situação:`,
      table: {
        kind: "astro_table",
        entityType: "proposal",
        title: "Propostas",
        columns: [
          { key: "situacao", label: "Situação", type: "badge" },
          { key: "quantas", label: "Quantas", type: "number" },
        ],
        rows: grouped.map((row) => ({
          id: row.status,
          situacao: LABEL[row.status] ?? row.status,
          quantas: row._count._all,
        })),
        totalCount: grouped.length,
      },
    };
  },
};

const forms: AstroQuery = {
  key: "form.list",
  app: "form",
  appKey: "formularios",
  matches: (text) => ASKS.test(text) && /\bformularios?|briefings?|fichas?\b/.test(text),
  run: async ({ ctx, text }) => {
    const period = periodFrom(text);
    const rows = await prisma.form.findMany({
      where: { organizationId: ctx.organizationId, ...createdWithin(period) },
      select: { id: true, name: true, published: true, responses: true },
      orderBy: { name: "asc" },
      take: 30,
    });
    if (rows.length === 0) {
      return { text: period ? `Nenhum formulário criado ${period.label}.` : "Nenhum formulário criado ainda." };
    }
    return {
      text: `${rows.length} ${plural(rows.length, "formulário", "formulários")}${period ? ` criado${plural(rows.length, "", "s")} ${period.label}` : ""}:`,
      table: {
        kind: "astro_table",
        entityType: "lead",
        title: "Formulários",
        columns: [
          { key: "name", label: "Formulário" },
          { key: "situacao", label: "Situação", type: "badge" },
          { key: "respostas", label: "Respostas", type: "number" },
        ],
        rows: rows.map((form) => ({
          id: form.id,
          name: form.name,
          situacao: form.published ? "No ar" : "Rascunho",
          respostas: form.responses,
        })),
        totalCount: rows.length,
      },
    };
  },
};

const workspaces: AstroQuery = {
  key: "workspace.list",
  app: "workspaces",
  appKey: "workspace",
  matches: (text) => ASKS.test(text) && /\bworkspaces?|quadros?\b/.test(text),
  run: async ({ ctx, text }) => {
    const period = periodFrom(text);
    const rows = await prisma.workspace.findMany({
      where: {
        organizationId: ctx.organizationId,
        isArchived: false,
        ...createdWithin(period),
      },
      select: { id: true, name: true, _count: { select: { actions: true } } },
      orderBy: { name: "asc" },
      take: 30,
    });
    if (rows.length === 0) {
      return { text: period ? `Nenhum workspace criado ${period.label}.` : "Nenhum workspace criado ainda." };
    }
    return {
      text: `${rows.length} ${plural(rows.length, "workspace", "workspaces")}${period ? ` criado${plural(rows.length, "", "s")} ${period.label}` : ""}:`,
      table: {
        kind: "astro_table",
        entityType: "action",
        title: "Workspaces",
        columns: [
          { key: "name", label: "Workspace" },
          { key: "tarefas", label: "Tarefas", type: "number" },
        ],
        rows: rows.map((workspace) => ({
          id: workspace.id,
          workspaceId: workspace.id,
          name: workspace.name,
          tarefas: workspace._count.actions,
        })),
        totalCount: rows.length,
      },
    };
  },
};

const pendingActions: AstroQuery = {
  key: "workspace.actions_pending",
  app: "workspaces",
  appKey: "workspace",
  matches: (text) =>
    /\btarefas?|acoes?|atividades?\b/.test(text) &&
    /\bpendentes?|abertas?|atrasadas?|quantas|quantos|vencidas?\b/.test(text),
  run: async ({ ctx, text }) => {
    const period = periodFrom(text);
    const base = {
      workspace: { organizationId: ctx.organizationId },
      isDone: false,
      ...createdWithin(period),
    };
    const [pending, overdue] = await Promise.all([
      prisma.action.count({ where: base }),
      prisma.action.count({ where: { ...base, dueDate: { lt: new Date() } } }),
    ]);
    if (pending === 0) {
      return { text: period ? `Nenhuma tarefa em aberto criada ${period.label}.` : "Nenhuma tarefa em aberto." };
    }
    return {
      text:
        `${pending} ${plural(pending, "tarefa em aberto", "tarefas em aberto")}` +
        (period ? ` criada${plural(pending, "", "s")} ${period.label}` : "") +
        (overdue > 0 ? `, sendo ${overdue} ${plural(overdue, "atrasada", "atrasadas")}.` : "."),
    };
  },
};

/**
 * Em aberto = ainda cobra alguma coisa. `as const` aqui não serve: o `in` do
 * Prisma pede array mutável.
 */
const OPEN_ENTRY_STATUSES: FinancialEntryStatus[] = ["PENDING", "PARTIAL", "OVERDUE"];

const financeSummary: AstroQuery = {
  key: "payment.summary",
  app: "payment",
  appKey: "financeiro",
  matches: (text) =>
    // "Financeiro" sozinho é resposta a uma pergunta, não pedido de relatório.
    /\bcontas? a (pagar|receber)|\ba pagar\b|\ba receber\b|vencid[oa]s?|inadimplen/.test(text) ||
    (/\bfinanceiro\b/.test(text) && /\b(quanto|quantos|resumo|situacao|como esta|saldo)\b/.test(text)),
  run: async ({ ctx }) => {
    const org = { organizationId: ctx.organizationId };
    const open = { status: { in: OPEN_ENTRY_STATUSES } };
    const [payable, receivable, overdue] = await Promise.all([
      prisma.paymentEntry.aggregate({
        where: { ...org, ...open, type: "PAYABLE" },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.paymentEntry.aggregate({
        where: { ...org, ...open, type: "RECEIVABLE" },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.paymentEntry.count({
        where: { ...org, ...open, dueDate: { lt: new Date() } },
      }),
    ]);
    const nothing = payable._count._all === 0 && receivable._count._all === 0;
    if (nothing) return { text: "Nenhum lançamento em aberto no financeiro." };
    return {
      text:
        `A pagar: ${money(payable._sum.amount ?? 0)} em ${payable._count._all} ${plural(payable._count._all, "lançamento", "lançamentos")}. ` +
        `A receber: ${money(receivable._sum.amount ?? 0)} em ${receivable._count._all}. ` +
        (overdue > 0 ? `${overdue} ${plural(overdue, "está vencido", "estão vencidos")}.` : "Nada vencido."),
    };
  },
};

const paidThisMonth: AstroQuery = {
  key: "payment.paid_month",
  app: "payment",
  appKey: "financeiro",
  matches: (text) => /\b(paguei|recebi|pago|recebido)\b/.test(text),
  run: async ({ ctx, text }) => {
    const period = periodFrom(text);
    const where = {
      organizationId: ctx.organizationId,
      status: "PAID" as const,
      paidAt: period
        ? { gte: period.since, lt: period.until }
        : { gte: startOfMonth() },
    };
    const [payable, receivable] = await Promise.all([
      prisma.paymentEntry.aggregate({ where: { ...where, type: "PAYABLE" }, _sum: { paidAmount: true } }),
      prisma.paymentEntry.aggregate({ where: { ...where, type: "RECEIVABLE" }, _sum: { paidAmount: true } }),
    ]);
    return {
      text:
        `${period ? period.label[0].toUpperCase() + period.label.slice(1) : "Neste mês"}: ` +
        `${money(receivable._sum.paidAmount ?? 0)} recebido e ` +
        `${money(payable._sum.paidAmount ?? 0)} pago.`,
    };
  },
};

const paymentAccounts: AstroQuery = {
  key: "payment.accounts_list",
  app: "payment",
  appKey: "financeiro",
  matches: (text) =>
    /\bcontas?\b/.test(text) &&
    /\b(quais|liste|lista|me envie|envie|me manda|manda|me mostra|mostra|quantas)\b/.test(text) &&
    !/\ba pagar\b|\ba receber\b|vencid/.test(text),
  run: async ({ ctx }) => {
    const rows = await prisma.paymentBankAccount.findMany({
      where: { organizationId: ctx.organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 20,
    });
    if (rows.length === 0) return { text: "Nenhuma conta bancária cadastrada." };
    return {
      text: `Você tem ${rows.length} ${plural(rows.length, "conta", "contas")}:`,
      table: {
        kind: "astro_table",
        entityType: "lead",
        title: "Contas bancárias",
        columns: [{ key: "name", label: "Conta" }],
        rows: rows.map((account) => ({ id: account.id, name: account.name })),
        totalCount: rows.length,
      },
    };
  },
};

const pages: AstroQuery = {
  key: "pages.list",
  app: "pages",
  appKey: "explorer",
  matches: (text) => ASKS.test(text) && /\bpaginas?|sites?|landing\b/.test(text),
  run: async ({ ctx, text }) => {
    const period = periodFrom(text);
    const rows = await prisma.nasaPage.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: { not: "ARCHIVED" },
        ...createdWithin(period),
      },
      select: { id: true, title: true, slug: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    });
    if (rows.length === 0) {
      return { text: period ? `Nenhuma página criada ${period.label}.` : "Nenhuma página criada ainda." };
    }
    return {
      text: `${rows.length} ${plural(rows.length, "página", "páginas")}${period ? ` criada${plural(rows.length, "", "s")} ${period.label}` : ""}:`,
      table: {
        kind: "astro_table",
        entityType: "lead",
        title: "Páginas",
        columns: [
          { key: "title", label: "Página" },
          { key: "situacao", label: "Situação", type: "badge" },
        ],
        rows: rows.map((page) => ({
          id: page.id,
          title: page.title,
          situacao: page.status === "PUBLISHED" ? "No ar" : "Rascunho",
        })),
        totalCount: rows.length,
      },
    };
  },
};

export const APP_QUERIES: AstroQuery[] = [
  paymentAccounts,
  messagesToday,
  unreadConversations,
  proposals,
  forms,
  pendingActions,
  workspaces,
  paidThisMonth,
  financeSummary,
  pages,
];
