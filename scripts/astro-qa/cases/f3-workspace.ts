import prisma from "../../../src/lib/prisma";
import { buildPickedAnswer, formatPickedDate } from "../../../src/features/astro/lib/astro-picker";
import { brazilDateTime } from "../brazil-time";
import { allReplyText, converse, expectNoOrchestrator, expectQuestionsHavePicker, removeCreatedSince } from "./qa-helpers";
import { expectThat, type QaCase, type QaCaseContext } from "./types";

// Workspace pelo roteiro (docs/astro-bateria-de-testes.md, F3 — Workspace).

function brazilDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function findCreatedTask(context: QaCaseContext) {
  return prisma.action.findFirst({
    where: { workspace: { organizationId: context.qaOrg.organizationId }, createdAt: { gte: context.startedAt } },
    select: {
      title: true,
      dueDate: true,
      priority: true,
      workspace: { select: { name: true } },
      column: { select: { name: true } },
      responsibles: { select: { userId: true } },
    },
  });
}

export const F3_WORKSPACE_CASES: QaCase[] = [
  {
    id: "F3-WKS-01",
    complexity: "N2",
    title: "Criar tarefa pelo roteiro: título → workspace → prazo → responsável → prioridade",
    run: async (context) => {
      const operacao = await prisma.workspace.findFirstOrThrow({
        where: { organizationId: context.qaOrg.organizationId, name: "Operação" },
        select: { id: true, name: true },
      });
      const dueDate = brazilDateTime(2, 12, 0, context.startedAt);
      const turns = await converse({
        context,
        firstMessage: "Quero criar uma tarefa",
        answers: {
          title: "Revisar contrato QA",
          workspaceName: buildPickedAnswer(operacao.name, operacao.id),
          dueAnswer: formatPickedDate(brazilDateKey(dueDate)),
          responsibleName: "eu mesmo",
          priorityName: "HIGH",
        },
        maxTurns: 8,
      });
      expectNoOrchestrator(turns);
      expectQuestionsHavePicker(turns);
      const created = await findCreatedTask(context);
      expectThat(created, `Não criou. Respostas: ${allReplyText(turns).slice(0, 300)}`);
      expectThat(created.title === "Revisar contrato QA", `Título: ${created.title}.`);
      expectThat(created.workspace.name === "Operação" && created.column?.name === "A fazer", `Lugar: ${created.workspace.name}/${created.column?.name}.`);
      expectThat(created.priority === "HIGH", `Prioridade: ${created.priority}.`);
      expectThat(created.dueDate && brazilDateKey(created.dueDate) === brazilDateKey(dueDate), `Prazo: ${created.dueDate?.toISOString()}.`);
      expectThat(
        created.responsibles.some((responsible) => responsible.userId === context.qaOrg.ownerUserId),
        "Responsável não é o dono.",
      );
    },
    cleanup: removeCreatedSince,
  },
  {
    id: "F3-WKS-02",
    complexity: "N2",
    title: "Frase completa: só o responsável é perguntado",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Cria a tarefa revisar contrato no workspace Operação para amanhã, urgente",
        answers: { responsibleName: "eu mesmo" },
      });
      expectNoOrchestrator(turns);
      const askedFields = turns.flatMap((turn) => {
        const result = turn.reply.actionResult;
        if (result?.status === "needs_input") return [result.missingFields[0]?.key];
        if (result?.status === "ambiguous") return [result.field];
        return [];
      });
      expectThat(
        askedFields.length === 1 && askedFields[0] === "responsibleName",
        `Perguntou: ${askedFields.join(", ")}. Respostas: ${allReplyText(turns).slice(0, 300)}`,
      );
      const created = await findCreatedTask(context);
      expectThat(created, `Não criou. Respostas: ${allReplyText(turns).slice(0, 300)}`);
      expectThat(created.priority === "URGENT", `Prioridade: ${created.priority}.`);
      const tomorrow = brazilDateTime(1, 12, 0, context.startedAt);
      expectThat(created.dueDate && brazilDateKey(created.dueDate) === brazilDateKey(tomorrow), `Prazo: ${created.dueDate?.toISOString()}.`);
    },
    cleanup: removeCreatedSince,
  },
  {
    id: "F3-WKS-03",
    complexity: "N1",
    title: "Criar workspace pela frase",
    run: async (context) => {
      const turns = await converse({ context, firstMessage: "Cria um workspace chamado QA WS", answers: {} });
      expectNoOrchestrator(turns);
      const created = await prisma.workspace.findFirst({
        where: { organizationId: context.qaOrg.organizationId, name: "QA WS" },
        select: { id: true },
      });
      expectThat(created, `Não criou. Respostas: ${allReplyText(turns).slice(0, 300)}`);
    },
    cleanup: removeCreatedSince,
  },
];
