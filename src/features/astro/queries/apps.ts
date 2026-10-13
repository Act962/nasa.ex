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
import { taskPrioritiesFrom } from "@/features/astro/actions/workspace/task-fields";

/** "Quais…", "liste…", "me mostra…": a pessoa quer os itens, não o número. */
const LISTS = /\b(quais|liste|lista|listar|mostra|mostre|me mostra|me manda|minhas|meus)\b/;
const MAX_LIST_ROWS = 30;

const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Enviada",
  VISUALIZADA: "Visualizada",
  PAGA: "Paga",
  EXPIRADA: "Expirada",
  CANCELADA: "Cancelada",
};

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
  // "quais produtos entram na proposta" pergunta de produto, não de proposta.
  matches: (text) =>
    ASKS.test(text) && /\bpropostas?|orcamentos?\b/.test(text) && !/\bprodutos?\b/.test(text),
  run: async ({ ctx, text }) => {
    const period = periodFrom(text);
    // "Quais propostas" pede as propostas; "quantas", a contagem por situação.
    if (LISTS.test(text)) {
      const onlyOpen = /\babertas?|em aberto|pendentes?\b/.test(text);
      const rows = await prisma.forgeProposal.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...createdWithin(period),
          ...(onlyOpen ? { status: { in: ["RASCUNHO", "ENVIADA", "VISUALIZADA"] } } : {}),
        },
        select: { id: true, number: true, title: true, status: true, client: { select: { name: true } } },
        orderBy: { number: "desc" },
        take: MAX_LIST_ROWS,
      });
      if (rows.length === 0) return { text: onlyOpen ? "Nenhuma proposta em aberto." : "Nenhuma proposta ainda." };
      return {
        text: `${rows.length} ${plural(rows.length, "proposta", "propostas")}${onlyOpen ? " em aberto" : ""}:`,
        table: {
          kind: "astro_table",
          entityType: "proposal",
          title: "Propostas",
          columns: [
            { key: "numero", label: "Nº" },
            { key: "titulo", label: "Título" },
            { key: "cliente", label: "Cliente" },
            { key: "situacao", label: "Situação", type: "badge" },
          ],
          rows: rows.map((row) => ({
            id: row.id,
            numero: `#${row.number}`,
            titulo: row.title,
            cliente: row.client?.name ?? "—",
            situacao: PROPOSAL_STATUS_LABELS[row.status] ?? row.status,
          })),
          totalCount: rows.length,
        },
      };
    }
    const grouped = await prisma.forgeProposal.groupBy({
      by: ["status"],
      where: { organizationId: ctx.organizationId, ...createdWithin(period) },
      _count: { _all: true },
    });
    if (grouped.length === 0) {
      return { text: period ? `Nenhuma proposta criada ${period.label}.` : "Nenhuma proposta criada ainda." };
    }
    const total = grouped.reduce((sum, row) => sum + row._count._all, 0);
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
          situacao: PROPOSAL_STATUS_LABELS[row.status] ?? row.status,
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

// Tarefas em aberto (spec 0078). Período na frase é PRAZO, não criação: "quantas tarefas tenho
// hoje?" contava as criadas hoje na empresa inteira. Só "criadas hoje" olha a data de criação.
const TASK_NOUN = /\b(tarefas?|acoes?|atividades?|demandas?)\b/;
const TASK_QUESTION = /\b(pendentes?|abertas?|atrasadas?|quantas|quantos|quais|vencidas?|prioridade|urgentes?)\b/;
const TASK_FOLLOW_UP = /\b(atrasadas?|vencidas?|pendentes?|prioridade|urgentes?)\b/;
const OTHER_SUBJECT = /\b(leads?|propostas?|contas?|lancamentos?|faturas?|cobrancas?|formularios?|compromissos?|mensagens?|clientes?)\b/;
const TASK_LISTS = /\b(quais|liste|lista|listar|mostra|mostre|me manda|traga|traz|trazer|minhas|meus)\b/;
const MINE = /\b(tenho|minhas|meus|comigo|estou)\b/;
const OVERDUE = /\b(atrasadas?|vencidas?)\b/;
const CREATED = /\bcriad[ao]s?\b/;

const pendingActions: AstroQuery = {
  key: "workspace.actions_pending",
  app: "workspaces",
  appKey: "workspace",
  matches: (text, history) => {
    if (TASK_NOUN.test(text)) return TASK_QUESTION.test(text);
    // "Quantas estão atrasadas?", "me traga as de alta prioridade": continuação de uma conversa sobre tarefas.
    return TASK_FOLLOW_UP.test(text) && !OTHER_SUBJECT.test(text) && TASK_NOUN.test(history);
  },
  run: async ({ ctx, text }) => {
    const period = periodFrom(text);
    const isAboutCreation = CREATED.test(text);
    const isToday = !isAboutCreation && period?.label === "hoje";
    const onlyMine = MINE.test(text);
    const onlyOverdue = OVERDUE.test(text);
    const priority = taskPrioritiesFrom(text);
    const now = new Date();
    const today = startOfToday();

    const scope = {
      workspace: { organizationId: ctx.organizationId },
      isDone: false,
      isArchived: false,
      ...(onlyMine ? { responsibles: { some: { userId: ctx.userId } } } : {}),
      ...(priority ? { priority: { in: priority.priorities } } : {}),
    };
    const dueWindow =
      period && !isAboutCreation && !isToday
        ? {
            gte: period.since,
            lt: period.futureUntil > period.until ? period.futureUntil : period.until,
          }
        : null;
    const base = {
      ...scope,
      ...(isAboutCreation ? createdWithin(period) : {}),
      // "Hoje" = o que vence hoje mais o que já passou do prazo.
      ...(isToday ? { dueDate: { lt: period.until } } : {}),
      ...(dueWindow ? { dueDate: dueWindow } : {}),
    };

    // Em "hoje", atrasada é a que venceu antes de hoje; o resto do dia ainda é "para hoje".
    const overdueBefore = isToday ? today : now;
    const overdueDue = dueWindow
      ? { gte: dueWindow.gte, lt: dueWindow.lt < overdueBefore ? dueWindow.lt : overdueBefore }
      : { lt: overdueBefore };
    const [pending, overdue] = await Promise.all([
      prisma.action.count({ where: base }),
      prisma.action.count({ where: { ...base, dueDate: overdueDue } }),
    ]);

    const qualifier = priority ? ` ${priority.label}` : "";
    const owner = onlyMine ? "Você tem " : "";
    const openLabel = (count: number) => `${count} ${plural(count, "tarefa", "tarefas")}${qualifier} em aberto`;

    let summary: string;
    if (onlyOverdue) {
      summary =
        overdue === 0
          ? `Nenhuma tarefa${qualifier} atrasada.`
          : `${owner}${overdue} ${plural(overdue, "tarefa", "tarefas")}${qualifier} ${plural(overdue, "atrasada", "atrasadas")}`;
    } else if (isToday) {
      const dueToday = pending - overdue;
      summary =
        pending === 0
          ? `Nenhuma tarefa${qualifier} para hoje nem atrasada.`
          : `${owner}${dueToday} ${plural(dueToday, "tarefa", "tarefas")}${qualifier} para hoje` +
            (overdue > 0 ? ` e ${overdue} ${plural(overdue, "atrasada", "atrasadas")}` : "");
    } else if (pending === 0) {
      summary = period
        ? `Nenhuma tarefa${qualifier} em aberto ${isAboutCreation ? "criada" : "com prazo"} ${period.label}.`
        : `Nenhuma tarefa${qualifier} em aberto.`;
    } else {
      summary =
        `${owner}${openLabel(pending)}` +
        (period ? ` ${isAboutCreation ? `criada${plural(pending, "", "s")}` : "com prazo"} ${period.label}` : "") +
        (overdue > 0 ? `, sendo ${overdue} ${plural(overdue, "atrasada", "atrasadas")}` : "");
    }

    const listedCount = onlyOverdue ? overdue : pending;
    // "Quais tarefas" pede as tarefas; "quantas", só o número.
    if (!TASK_LISTS.test(text) || listedCount === 0) {
      return { text: /[.!?]$/.test(summary) ? summary : `${summary}.` };
    }

    const tasks = await prisma.action.findMany({
      where: { ...base, ...(onlyOverdue ? { dueDate: overdueDue } : {}) },
      select: { id: true, title: true, dueDate: true, workspaceId: true, workspace: { select: { name: true } } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
      take: MAX_LIST_ROWS,
    });
    return {
      text: `${summary}:`,
      table: {
        kind: "astro_table",
        entityType: "action",
        title: onlyOverdue ? "Tarefas atrasadas" : "Tarefas em aberto",
        columns: [
          { key: "tarefa", label: "Tarefa" },
          { key: "workspace", label: "Workspace" },
          { key: "prazo", label: "Prazo" },
        ],
        rows: tasks.map((task) => ({
          id: task.id,
          workspaceId: task.workspaceId,
          tarefa: task.title,
          workspace: task.workspace.name,
          prazo: task.dueDate
            ? task.dueDate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
            : "—",
        })),
        totalCount: listedCount,
      },
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
