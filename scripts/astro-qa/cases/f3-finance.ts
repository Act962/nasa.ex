import prisma from "../../../src/lib/prisma";
import { buildPickedAnswer, formatPickedDate } from "../../../src/features/astro/lib/astro-picker";
import { brazilDateTime } from "../brazil-time";
import { clearFinanceData, seedFinanceData } from "../seed";
import { allReplyText, converse, expectNoOrchestrator, expectQuestionsHavePicker } from "./qa-helpers";
import { expectThat, type QaCase, type QaCaseContext } from "./types";

// Financeiro pelo roteiro (docs/astro-bateria-de-testes.md, F3 — Financeiro).

/** Casos de Financeiro mexem nos lançamentos da massa: a limpeza recria tudo. */
async function resetFinance(context: QaCaseContext): Promise<void> {
  await clearFinanceData(context.qaOrg.organizationId);
  await seedFinanceData(context.qaOrg.organizationId, context.qaOrg.ownerUserId);
}

async function findAccount(context: QaCaseContext, name: string) {
  return prisma.paymentBankAccount.findFirstOrThrow({
    where: { organizationId: context.qaOrg.organizationId, name },
    select: { id: true, name: true },
  });
}

async function findCategory(context: QaCaseContext, name: string) {
  return prisma.paymentCategory.findFirstOrThrow({
    where: { organizationId: context.qaOrg.organizationId, name },
    select: { id: true, name: true },
  });
}

function findCreatedEntry(context: QaCaseContext) {
  return prisma.paymentEntry.findFirst({
    where: { organizationId: context.qaOrg.organizationId, createdAt: { gte: context.startedAt } },
    select: {
      description: true,
      amount: true,
      status: true,
      type: true,
      dueDate: true,
      account: { select: { name: true } },
      category: { select: { name: true } },
    },
  });
}

function findEntryStatus(context: QaCaseContext, description: string) {
  return prisma.paymentEntry.findFirst({
    where: { organizationId: context.qaOrg.organizationId, description },
    select: { status: true },
  });
}

function brazilDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export const F3_FINANCE_CASES: QaCase[] = [
  {
    id: "F3-FIN-01",
    complexity: "N2",
    title: "Lançar despesa pelo roteiro: descrição → valor → vencimento → conta → categoria",
    run: async (context) => {
      const [banco, operacional] = await Promise.all([
        findAccount(context, "Banco"),
        findCategory(context, "Operacional"),
      ]);
      const dueDate = brazilDateTime(5, 12, 0, context.startedAt);
      const turns = await converse({
        context,
        firstMessage: "Quero lançar uma despesa",
        answers: {
          description: "Internet QA",
          amount: "150,00",
          dueDate: formatPickedDate(brazilDateKey(dueDate)),
          accountName: buildPickedAnswer(banco.name, banco.id),
          categoryName: buildPickedAnswer(operacional.name, operacional.id),
        },
        maxTurns: 9,
      });
      expectNoOrchestrator(turns);
      expectQuestionsHavePicker(turns);
      const created = await findCreatedEntry(context);
      expectThat(created, `Não lançou. Respostas: ${allReplyText(turns).slice(0, 300)}`);
      expectThat(created.type === "PAYABLE" && created.amount === 15000, `Tipo/valor: ${created.type} ${created.amount}.`);
      expectThat(created.status === "PENDING", `Situação: ${created.status}.`);
      expectThat(created.account?.name === "Banco", `Conta: ${created.account?.name}.`);
      expectThat(created.category?.name === "Operacional", `Categoria: ${created.category?.name}.`);
      expectThat(brazilDateKey(created.dueDate) === brazilDateKey(dueDate), `Vencimento: ${created.dueDate.toISOString()}.`);
    },
    cleanup: resetFinance,
  },
  {
    id: "F3-FIN-02",
    complexity: "N2",
    title: "Frase completa: só conta e categoria são perguntadas",
    run: async (context) => {
      const [banco, operacional] = await Promise.all([
        findAccount(context, "Banco"),
        findCategory(context, "Operacional"),
      ]);
      const turns = await converse({
        context,
        firstMessage: "Lança uma despesa de R$ 150,00 de internet vencendo dia 10",
        answers: {
          accountName: buildPickedAnswer(banco.name, banco.id),
          categoryName: buildPickedAnswer(operacional.name, operacional.id),
        },
      });
      expectNoOrchestrator(turns);
      const askedFields = turns.flatMap((turn) => {
        const result = turn.reply.actionResult;
        if (result?.status === "needs_input") return [result.missingFields[0]?.key];
        if (result?.status === "ambiguous") return [result.field];
        return [];
      });
      expectThat(
        askedFields.every((field) => field === "accountName" || field === "categoryName"),
        `Perguntou além de conta e categoria: ${askedFields.join(", ")}`,
      );
      const created = await findCreatedEntry(context);
      expectThat(created, `Não lançou. Respostas: ${allReplyText(turns).slice(0, 300)}`);
      expectThat(created.amount === 15000 && created.description === "internet", `Lançamento: ${JSON.stringify(created)}.`);
      expectThat(brazilDateKey(created.dueDate).endsWith("-10"), `Vencimento: ${created.dueDate.toISOString()}.`);
    },
    cleanup: resetFinance,
  },
  {
    id: "F3-FIN-03",
    complexity: "N2",
    title: "\"Paguei 50 reais de estacionamento\" nasce paga",
    run: async (context) => {
      const [caixa, operacional] = await Promise.all([
        findAccount(context, "Caixa"),
        findCategory(context, "Operacional"),
      ]);
      const turns = await converse({
        context,
        firstMessage: "Paguei 50 reais de estacionamento",
        answers: {
          accountName: buildPickedAnswer(caixa.name, caixa.id),
          categoryName: buildPickedAnswer(operacional.name, operacional.id),
        },
      });
      expectNoOrchestrator(turns);
      const created = await findCreatedEntry(context);
      expectThat(created, `Não lançou. Respostas: ${allReplyText(turns).slice(0, 300)}`);
      expectThat(created.amount === 5000 && created.status === "PAID", `Lançamento: ${created.amount} ${created.status}.`);
    },
    cleanup: resetFinance,
  },
  {
    id: "F3-FIN-04",
    complexity: "N1",
    title: "Dar baixa pela frase",
    run: async (context) => {
      const turns = await converse({ context, firstMessage: "Marca a conta de internet como paga", answers: {} });
      expectNoOrchestrator(turns);
      const entry = await findEntryStatus(context, "Conta de internet");
      expectThat(entry?.status === "PAID", `Situação: ${entry?.status}. Respostas: ${allReplyText(turns).slice(0, 300)}`);
    },
    cleanup: resetFinance,
  },
  {
    id: "F3-FIN-05",
    complexity: "N2",
    title: "Dar baixa pelo roteiro: busca de lançamento em aberto",
    run: async (context) => {
      const rent = await prisma.paymentEntry.findFirstOrThrow({
        where: { organizationId: context.qaOrg.organizationId, description: "Aluguel" },
        select: { id: true, description: true },
      });
      const turns = await converse({
        context,
        firstMessage: "Quero dar baixa num lançamento",
        answers: { description: buildPickedAnswer(rent.description, rent.id) },
      });
      expectNoOrchestrator(turns);
      expectQuestionsHavePicker(turns);
      const entry = await findEntryStatus(context, "Aluguel");
      expectThat(entry?.status === "PAID", `Situação: ${entry?.status}. Respostas: ${allReplyText(turns).slice(0, 300)}`);
    },
    cleanup: resetFinance,
  },
];
