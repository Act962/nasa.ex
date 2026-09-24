import "server-only";
import prisma from "@/lib/prisma";
import { ASKS, money, plural, startOfMonth, startOfToday, type AstroQuery } from "./types";

// Consultas dos demais apps — chat, forge, formulários, workspaces,
// financeiro e páginas. Um arquivo só porque cada app tem poucas perguntas
// de rotina; quando um crescer, ele ganha o seu.

const unreadConversations: AstroQuery = {
  key: "chat.unread",
  app: "chat",
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
  matches: (text) => /\bmensagens?\b/.test(text) && /\bhoje\b/.test(text),
  run: async ({ ctx }) => {
    const where = {
      createdAt: { gte: startOfToday() },
      conversation: { tracking: { organizationId: ctx.organizationId } },
    };
    const [received, sent] = await Promise.all([
      prisma.message.count({ where: { ...where, fromMe: false } }),
      prisma.message.count({ where: { ...where, fromMe: true } }),
    ]);
    return {
      text: `Hoje: ${received} ${plural(received, "mensagem recebida", "mensagens recebidas")} e ${sent} ${plural(sent, "enviada", "enviadas")}.`,
    };
  },
};

const proposals: AstroQuery = {
  key: "forge.proposals",
  app: "forge",
  matches: (text) => ASKS.test(text) && /\bpropostas?|orcamentos?\b/.test(text),
  run: async ({ ctx }) => {
    const grouped = await prisma.forgeProposal.groupBy({
      by: ["status"],
      where: { organizationId: ctx.organizationId },
      _count: { _all: true },
    });
    if (grouped.length === 0) return { text: "Nenhuma proposta criada ainda." };
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
      text: `${total} ${plural(total, "proposta", "propostas")}, por situação:`,
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
  matches: (text) => ASKS.test(text) && /\bformularios?|briefings?|fichas?\b/.test(text),
  run: async ({ ctx }) => {
    const rows = await prisma.form.findMany({
      where: { organizationId: ctx.organizationId },
      select: { id: true, name: true, published: true, responses: true },
      orderBy: { name: "asc" },
      take: 30,
    });
    if (rows.length === 0) return { text: "Nenhum formulário criado ainda." };
    return {
      text: `Você tem ${rows.length} ${plural(rows.length, "formulário", "formulários")}:`,
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
  matches: (text) => ASKS.test(text) && /\bworkspaces?|quadros?\b/.test(text),
  run: async ({ ctx }) => {
    const rows = await prisma.workspace.findMany({
      where: { organizationId: ctx.organizationId, isArchived: false },
      select: { id: true, name: true, _count: { select: { actions: true } } },
      orderBy: { name: "asc" },
      take: 30,
    });
    if (rows.length === 0) return { text: "Nenhum workspace criado ainda." };
    return {
      text: `Você tem ${rows.length} ${plural(rows.length, "workspace", "workspaces")}:`,
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
  matches: (text) =>
    /\btarefas?|acoes?|atividades?\b/.test(text) &&
    /\bpendentes?|abertas?|atrasadas?|quantas|quantos|vencidas?\b/.test(text),
  run: async ({ ctx }) => {
    const base = { workspace: { organizationId: ctx.organizationId }, isDone: false };
    const [pending, overdue] = await Promise.all([
      prisma.action.count({ where: base }),
      prisma.action.count({ where: { ...base, dueDate: { lt: new Date() } } }),
    ]);
    if (pending === 0) return { text: "Nenhuma tarefa em aberto." };
    return {
      text:
        `${pending} ${plural(pending, "tarefa em aberto", "tarefas em aberto")}` +
        (overdue > 0 ? `, sendo ${overdue} ${plural(overdue, "atrasada", "atrasadas")}.` : "."),
    };
  },
};

const financeSummary: AstroQuery = {
  key: "payment.summary",
  app: "payment",
  matches: (text) =>
    /\bcontas? a (pagar|receber)|financeiro|a pagar|a receber|vencid[oa]s?|inadimplen/.test(text),
  run: async ({ ctx }) => {
    const org = { organizationId: ctx.organizationId };
    const open = { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] as const } };
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
  matches: (text) => /\b(paguei|recebi|pago|recebido)\b/.test(text) && /\bmes\b/.test(text),
  run: async ({ ctx }) => {
    const where = {
      organizationId: ctx.organizationId,
      status: "PAID" as const,
      paidAt: { gte: startOfMonth() },
    };
    const [payable, receivable] = await Promise.all([
      prisma.paymentEntry.aggregate({ where: { ...where, type: "PAYABLE" }, _sum: { paidAmount: true } }),
      prisma.paymentEntry.aggregate({ where: { ...where, type: "RECEIVABLE" }, _sum: { paidAmount: true } }),
    ]);
    return {
      text:
        `Neste mês: ${money(receivable._sum.paidAmount ?? 0)} recebido e ` +
        `${money(payable._sum.paidAmount ?? 0)} pago.`,
    };
  },
};

const pages: AstroQuery = {
  key: "pages.list",
  app: "pages",
  matches: (text) => ASKS.test(text) && /\bpaginas?|sites?|landing\b/.test(text),
  run: async ({ ctx }) => {
    const rows = await prisma.nasaPage.findMany({
      where: { organizationId: ctx.organizationId, status: { not: "ARCHIVED" } },
      select: { id: true, title: true, slug: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    });
    if (rows.length === 0) return { text: "Nenhuma página criada ainda." };
    return {
      text: `Você tem ${rows.length} ${plural(rows.length, "página", "páginas")}:`,
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
