import prisma from "../../../src/lib/prisma";
import { buildPickedAnswer } from "../../../src/features/astro/lib/astro-picker";
import {
  allReplyText,
  converse,
  expectNoOrchestrator,
  expectQuestionsHavePicker,
  findSeedLead,
  removeCreatedSince,
  restoreSeedLead,
  snapshotSeedLead,
} from "./qa-helpers";
import { expectThat, type QaCase, type QaCaseContext } from "./types";

// Tracking pelo roteiro (docs/astro-bateria-de-testes.md, F3 — Tracking).

async function findStatusId(context: QaCaseContext, trackingName: string, statusName: string) {
  const status = await prisma.status.findFirstOrThrow({
    where: { name: statusName, tracking: { name: trackingName, organizationId: context.qaOrg.organizationId } },
    select: { id: true, name: true },
  });
  return status;
}

async function findCreatedLead(context: QaCaseContext, name: string) {
  return prisma.lead.findFirst({
    where: {
      name,
      tracking: { organizationId: context.qaOrg.organizationId },
      createdAt: { gte: context.startedAt },
    },
    select: { id: true, phone: true, status: { select: { name: true } }, tracking: { select: { name: true } } },
  });
}

export const F3_TRACKING_CASES: QaCase[] = [
  {
    id: "F3-LEAD-01",
    complexity: "N2",
    title: "Criar lead pelo roteiro: nome → funil → telefone",
    run: async (context) => {
      const vendas = await prisma.tracking.findFirstOrThrow({
        where: { organizationId: context.qaOrg.organizationId, name: "Vendas" },
      });
      const turns = await converse({
        context,
        firstMessage: "Quero criar um lead",
        answers: {
          leadName: "Teste QA 01",
          trackingName: buildPickedAnswer(vendas.name, vendas.id),
          phone: "86 99999-0001",
        },
      });
      expectNoOrchestrator(turns);
      expectQuestionsHavePicker(turns);
      const created = await findCreatedLead(context, "Teste QA 01");
      expectThat(created, `Não criou. Respostas: ${allReplyText(turns).slice(0, 300)}`);
      expectThat(created.tracking.name === "Vendas", `Funil errado: ${created.tracking.name}.`);
      expectThat(created.status.name === "Novo", `Coluna errada: ${created.status.name}.`);
      expectThat(created.phone === "5586999990001", `Telefone errado: ${created.phone}.`);
    },
    cleanup: removeCreatedSince,
  },
  {
    id: "F3-LEAD-02",
    complexity: "N1",
    title: "Frase completa cria o lead sem perguntar",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Cria o lead Teste QA 02, telefone 86 99999-0002, no funil Vendas",
        answers: {},
      });
      expectNoOrchestrator(turns);
      expectThat(turns.length === 1, `Perguntou algo: ${allReplyText(turns).slice(0, 300)}`);
      const created = await findCreatedLead(context, "Teste QA 02");
      expectThat(created, `Não criou. Respostas: ${allReplyText(turns).slice(0, 300)}`);
      expectThat(created.phone === "5586999990002", `Telefone errado: ${created.phone}.`);
    },
    cleanup: removeCreatedSince,
  },
  {
    id: "F3-LEAD-03",
    complexity: "N1",
    title: "Mover lead pela frase",
    run: async (context) => {
      const lead = await snapshotSeedLead(context, "Maria Clara");
      const turns = await converse({ context, firstMessage: "Move a Maria Clara para Ganho", answers: {} });
      expectNoOrchestrator(turns);
      const ganho = await findStatusId(context, "Vendas", "Ganho");
      const moved = await findSeedLead(context, "Maria Clara");
      expectThat(moved?.statusId === ganho.id, `Não moveu para Ganho. Respostas: ${allReplyText(turns).slice(0, 300)}`);
      expectThat(lead.statusId !== ganho.id, "A massa já estava em Ganho.");
    },
    cleanup: restoreSeedLead,
  },
  {
    id: "F3-LEAD-04",
    complexity: "N2",
    title: "Mover lead pelo roteiro: lead → coluna",
    run: async (context) => {
      const lead = await snapshotSeedLead(context, "Maria Clara");
      const qualificado = await findStatusId(context, "Vendas", "Qualificado");
      const turns = await converse({
        context,
        firstMessage: "Quero mover um lead",
        answers: {
          leadName: buildPickedAnswer(lead.name, lead.id),
          statusName: buildPickedAnswer(qualificado.name, qualificado.id),
        },
      });
      expectNoOrchestrator(turns);
      expectQuestionsHavePicker(turns);
      const moved = await findSeedLead(context, "Maria Clara");
      expectThat(moved?.statusId === qualificado.id, `Não moveu. Respostas: ${allReplyText(turns).slice(0, 300)}`);
    },
    cleanup: restoreSeedLead,
  },
  {
    id: "F3-LEAD-05",
    complexity: "N1",
    title: "Editar telefone pela frase",
    run: async (context) => {
      await snapshotSeedLead(context, "Maria Clara");
      const turns = await converse({
        context,
        firstMessage: "Muda o telefone da Maria Clara para 86 98888-7777",
        answers: {},
      });
      expectNoOrchestrator(turns);
      const updated = await findSeedLead(context, "Maria Clara");
      expectThat(
        updated?.phone?.replace(/\D/g, "").endsWith("86988887777"),
        `Telefone não mudou: ${updated?.phone}. Respostas: ${allReplyText(turns).slice(0, 300)}`,
      );
    },
    cleanup: restoreSeedLead,
  },
  {
    id: "F3-LEAD-06",
    complexity: "N2",
    title: "Editar lead pelo roteiro: lead → o quê → valor",
    run: async (context) => {
      const lead = await snapshotSeedLead(context, "Maria Clara");
      const turns = await converse({
        context,
        firstMessage: "Quero atualizar um lead",
        answers: {
          leadName: buildPickedAnswer(lead.name, lead.id),
          fieldToChange: "temperature",
          newValue: "quente",
        },
      });
      expectNoOrchestrator(turns);
      expectQuestionsHavePicker(turns);
      const updated = await findSeedLead(context, "Maria Clara");
      expectThat(updated?.temperature === "HOT", `Temperatura: ${updated?.temperature}. Respostas: ${allReplyText(turns).slice(0, 300)}`);
    },
    cleanup: restoreSeedLead,
  },
  {
    id: "F3-LEAD-07",
    complexity: "N1",
    title: "Anotar no lead pela frase",
    run: async (context) => {
      const lead = await snapshotSeedLead(context, "Maria Clara");
      const turns = await converse({
        context,
        firstMessage: "Anota na Maria Clara que pediu desconto",
        answers: {},
      });
      expectNoOrchestrator(turns);
      const note = await prisma.leadHistory.findFirst({
        where: { leadId: lead.id, createdAt: { gte: context.startedAt } },
        select: { id: true },
      });
      expectThat(note, `Nota não gravada. Respostas: ${allReplyText(turns).slice(0, 300)}`);
    },
    cleanup: restoreSeedLead,
  },
];
