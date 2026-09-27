import prisma from "../../../src/lib/prisma";
import { buildPickedAnswer, buildPickedList } from "../../../src/features/astro/lib/astro-picker";
import { clearForgeData, seedForgeData } from "../seed";
import { allReplyText, converse, expectNoOrchestrator, expectQuestionsHavePicker } from "./qa-helpers";
import { expectThat, type QaCase, type QaCaseContext } from "./types";

// Forge pelo roteiro (docs/astro-bateria-de-testes.md, F3 — Forge).

const DAY_MS = 24 * 60 * 60_000;

/** Casos de Forge mexem nas propostas da massa: a limpeza recria o Forge inteiro. */
async function resetForge(context: QaCaseContext): Promise<void> {
  await clearForgeData(context.qaOrg.organizationId);
  await seedForgeData(context.qaOrg.organizationId, context.qaOrg.ownerUserId);
}

function findProposalByNumber(context: QaCaseContext, number: number) {
  return prisma.forgeProposal.findUnique({
    where: { organizationId_number: { organizationId: context.qaOrg.organizationId, number } },
    select: {
      id: true,
      title: true,
      status: true,
      validUntil: true,
      products: { select: { quantity: true, product: { select: { name: true } } } },
    },
  });
}

function findCreatedProposal(context: QaCaseContext) {
  return prisma.forgeProposal.findFirst({
    where: { organizationId: context.qaOrg.organizationId, createdAt: { gte: context.startedAt } },
    select: {
      title: true,
      validUntil: true,
      client: { select: { name: true } },
      products: { select: { quantity: true, product: { select: { name: true } } } },
    },
  });
}

function daysFromStart(context: QaCaseContext, date: Date | null | undefined): number | null {
  return date ? Math.round((date.getTime() - context.startedAt.getTime()) / DAY_MS) : null;
}

export const F3_FORGE_CASES: QaCase[] = [
  {
    id: "F3-FRG-01",
    complexity: "N2",
    title: "Criar proposta pelo roteiro: cliente → produtos → validade → título",
    run: async (context) => {
      const organizationId = context.qaOrg.organizationId;
      const [client, setup] = await Promise.all([
        prisma.lead.findFirstOrThrow({ where: { tracking: { organizationId }, name: "Maria Clara" } }),
        prisma.forgeProduct.findFirstOrThrow({ where: { organizationId, name: "Setup (Única)" } }),
      ]);
      const turns = await converse({
        context,
        firstMessage: "Quero criar uma proposta",
        answers: {
          clientName: buildPickedAnswer(client.name, client.id),
          productName: buildPickedList([{ label: setup.name, id: setup.id, quantity: 2 }]),
          validUntil: "7 dias",
          confirmedTitle: "Proposta QA",
        },
      });
      expectNoOrchestrator(turns);
      expectQuestionsHavePicker(turns);
      const created = await findCreatedProposal(context);
      expectThat(created, `Não criou. Respostas: ${allReplyText(turns).slice(0, 300)}`);
      expectThat(created.client?.name === "Maria Clara", `Cliente errado: ${created.client?.name}.`);
      expectThat(created.title === "Proposta QA", `Título errado: ${created.title}.`);
      const [item] = created.products;
      expectThat(
        created.products.length === 1 && item.product.name === "Setup (Única)" && Number(item.quantity) === 2,
        `Itens errados: ${JSON.stringify(created.products)}.`,
      );
      const validityDays = daysFromStart(context, created.validUntil);
      expectThat(validityDays === 7 || validityDays === 8, `Validade de ${validityDays} dias.`);
    },
    cleanup: resetForge,
  },
  {
    id: "F3-FRG-02",
    complexity: "N2",
    title: "Frase completa: só o título é perguntado",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Cria uma proposta de Consultoria para a Maria Clara com validade de 7 dias",
        answers: { confirmedTitle: "Proposta Consultoria QA" },
      });
      expectNoOrchestrator(turns);
      const questions = turns.filter((turn) => turn.reply.actionResult?.status === "needs_input");
      expectThat(
        questions.length === 1 && questions[0].reply.actionResult?.status === "needs_input" &&
          questions[0].reply.actionResult.missingFields[0]?.key === "confirmedTitle",
        `Perguntou mais que o título: ${questions.map((turn) => turn.reply.text.slice(0, 60)).join(" | ")}`,
      );
      const created = await findCreatedProposal(context);
      expectThat(created, `Não criou. Respostas: ${allReplyText(turns).slice(0, 300)}`);
      expectThat(
        created.products.length === 1 && created.products[0].product.name === "Consultoria",
        `Itens errados: ${JSON.stringify(created.products)}.`,
      );
    },
    cleanup: resetForge,
  },
  {
    id: "F3-FRG-03",
    complexity: "N1",
    title: "Acrescentar produto pela frase",
    run: async (context) => {
      const turns = await converse({ context, firstMessage: "Adiciona o Setup na proposta #1", answers: {} });
      expectNoOrchestrator(turns);
      const proposal = await findProposalByNumber(context, 1);
      expectThat(
        proposal?.products.some((item) => item.product.name === "Setup (Única)"),
        `Setup não entrou na #1. Respostas: ${allReplyText(turns).slice(0, 300)}`,
      );
    },
    cleanup: resetForge,
  },
  {
    id: "F3-FRG-04",
    complexity: "N2",
    title: "Alterar proposta pelo roteiro: proposta → o quê → validade",
    run: async (context) => {
      const target = await findProposalByNumber(context, 2);
      expectThat(target, "Massa sem a proposta #2.");
      const turns = await converse({
        context,
        firstMessage: "Quero alterar uma proposta",
        answers: {
          proposalRef: buildPickedAnswer(`#2 ${target.title}`, target.id),
          changeKind: "validUntil",
          validUntil: "30 dias",
        },
      });
      expectNoOrchestrator(turns);
      expectQuestionsHavePicker(turns);
      const updated = await findProposalByNumber(context, 2);
      const validityDays = daysFromStart(context, updated?.validUntil);
      expectThat(
        validityDays === 30 || validityDays === 31,
        `Validade de ${validityDays} dias. Respostas: ${allReplyText(turns).slice(0, 300)}`,
      );
    },
    cleanup: resetForge,
  },
  {
    id: "F3-FRG-05",
    complexity: "N1",
    title: "Cancelar proposta pela frase",
    run: async (context) => {
      const turns = await converse({ context, firstMessage: "Cancela a proposta #1", answers: {} });
      expectNoOrchestrator(turns);
      const proposal = await findProposalByNumber(context, 1);
      expectThat(proposal?.status === "CANCELADA", `Situação: ${proposal?.status}. Respostas: ${allReplyText(turns).slice(0, 300)}`);
    },
    cleanup: resetForge,
  },
  {
    id: "F3-FRG-06",
    complexity: "N2",
    title: "Cancelar proposta pelo roteiro: busca da proposta",
    run: async (context) => {
      const target = await findProposalByNumber(context, 1);
      expectThat(target, "Massa sem a proposta #1.");
      const turns = await converse({
        context,
        firstMessage: "Quero cancelar uma proposta",
        answers: { proposalRef: buildPickedAnswer(`#1 ${target.title}`, target.id) },
      });
      expectNoOrchestrator(turns);
      expectQuestionsHavePicker(turns);
      const proposal = await findProposalByNumber(context, 1);
      expectThat(proposal?.status === "CANCELADA", `Situação: ${proposal?.status}. Respostas: ${allReplyText(turns).slice(0, 300)}`);
    },
    cleanup: resetForge,
  },
  {
    id: "F3-FRG-07",
    complexity: "N1",
    title: "Excluir rascunho vazio pela frase",
    run: async (context) => {
      const turns = await converse({ context, firstMessage: "Exclui a proposta #3", answers: {} });
      expectNoOrchestrator(turns);
      const proposal = await findProposalByNumber(context, 3);
      expectThat(!proposal, `A #3 continua lá. Respostas: ${allReplyText(turns).slice(0, 300)}`);
    },
    cleanup: resetForge,
  },
];
