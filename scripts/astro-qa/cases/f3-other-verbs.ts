import prisma from "../../../src/lib/prisma";
import { buildPickedAnswer, formatPickedDate } from "../../../src/features/astro/lib/astro-picker";
import { brazilDateTime, nextBrazilWeekday } from "../brazil-time";
import { clearQaData, seedQaData } from "../seed";
import { allReplyText, converse, expectNoOrchestrator, expectQuestionsHavePicker } from "./qa-helpers";
import { expectThat, type QaCase, type QaCaseContext } from "./types";

// Funil, tags, agenda e lembretes pelo roteiro (docs/astro-bateria-de-testes.md, F3).

/** Estes verbos mexem em funil, coluna e agenda da massa: a limpeza recria tudo. */
export async function reseedAll(context: QaCaseContext): Promise<void> {
  await prisma.reminder.deleteMany({
    where: { createdByUserId: context.qaOrg.ownerUserId, createdAt: { gte: context.startedAt }, trackingId: null },
  });
  await clearQaData(context.qaOrg.organizationId);
  await seedQaData(context.qaOrg.organizationId, context.qaOrg.ownerUserId);
}

function findTracking(context: QaCaseContext, name: string) {
  return prisma.tracking.findFirst({
    where: { organizationId: context.qaOrg.organizationId, name },
    select: { id: true, name: true, archivedAt: true, status: { select: { name: true }, orderBy: { order: "asc" } } },
  });
}

function brazilDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export const F3_OTHER_VERB_CASES: QaCase[] = [
  {
    id: "F3-TRK-01",
    complexity: "N1",
    title: "Criar funil pela frase",
    run: async (context) => {
      const turns = await converse({ context, firstMessage: "Cria o funil QA Funil", answers: {} });
      expectNoOrchestrator(turns);
      expectThat(await findTracking(context, "QA Funil"), `Não criou. Respostas: ${allReplyText(turns).slice(0, 300)}`);
    },
    cleanup: reseedAll,
  },
  {
    id: "F3-TRK-02",
    complexity: "N1",
    title: "Criar coluna pela frase",
    run: async (context) => {
      const turns = await converse({ context, firstMessage: "Cria a etapa Negociação no funil Vendas", answers: {} });
      expectNoOrchestrator(turns);
      const vendas = await findTracking(context, "Vendas");
      expectThat(vendas?.status.at(-1)?.name === "Negociação", `Colunas: ${vendas?.status.map((item) => item.name).join(", ")}.`);
    },
    cleanup: reseedAll,
  },
  {
    id: "F3-TRK-03",
    complexity: "N2",
    title: "Renomear coluna pelo roteiro: funil → coluna → nome",
    run: async (context) => {
      const vendas = await findTracking(context, "Vendas");
      expectThat(vendas, "Massa sem o funil Vendas.");
      const proposta = await prisma.status.findFirstOrThrow({ where: { trackingId: vendas.id, name: "Proposta" } });
      const turns = await converse({
        context,
        firstMessage: "Quero renomear uma coluna",
        answers: {
          trackingName: buildPickedAnswer(vendas.name, vendas.id),
          currentName: buildPickedAnswer(proposta.name, proposta.id),
          newName: "Proposta enviada",
        },
      });
      expectNoOrchestrator(turns);
      expectQuestionsHavePicker(turns);
      const renamed = await prisma.status.findUnique({ where: { id: proposta.id }, select: { name: true } });
      expectThat(renamed?.name === "Proposta enviada", `Nome: ${renamed?.name}. Respostas: ${allReplyText(turns).slice(0, 300)}`);
    },
    cleanup: reseedAll,
  },
  {
    id: "F3-TRK-04",
    complexity: "N1",
    title: "Renomear funil pela frase",
    run: async (context) => {
      const turns = await converse({ context, firstMessage: "Renomeia o funil Suporte para Atendimento", answers: {} });
      expectNoOrchestrator(turns);
      expectThat(await findTracking(context, "Atendimento"), `Não renomeou. Respostas: ${allReplyText(turns).slice(0, 300)}`);
    },
    cleanup: reseedAll,
  },
  {
    id: "F3-TRK-05",
    complexity: "N1",
    title: "Arquivar funil pela frase",
    run: async (context) => {
      const turns = await converse({ context, firstMessage: "Arquiva o funil Suporte", answers: {} });
      expectNoOrchestrator(turns);
      const suporte = await findTracking(context, "Suporte");
      expectThat(suporte?.archivedAt, `Não arquivou. Respostas: ${allReplyText(turns).slice(0, 300)}`);
    },
    cleanup: reseedAll,
  },
  {
    id: "F3-TRK-06",
    complexity: "N2",
    title: "Adicionar participante pelo roteiro: pessoa → funil",
    run: async (context) => {
      const [owner, suporte] = await Promise.all([
        prisma.user.findUniqueOrThrow({ where: { id: context.qaOrg.ownerUserId }, select: { id: true, name: true } }),
        findTracking(context, "Suporte"),
      ]);
      expectThat(suporte, "Massa sem o funil Suporte.");
      const turns = await converse({
        context,
        firstMessage: "Quero adicionar um participante",
        answers: {
          personName: buildPickedAnswer(owner.name, owner.id),
          trackingName: buildPickedAnswer(suporte.name, suporte.id),
        },
      });
      expectNoOrchestrator(turns);
      expectQuestionsHavePicker(turns);
      const participations = await prisma.trackingParticipant.count({
        where: { trackingId: suporte.id, userId: owner.id },
      });
      expectThat(participations === 1, `Participações do dono: ${participations}.`);
      expectThat(turns.at(-1)?.reply.actionResult?.status !== undefined, "Sem resposta final do roteiro.");
    },
    cleanup: reseedAll,
  },
  {
    id: "F3-TAG-01",
    complexity: "N2",
    title: "Criar tag pelo roteiro: nome → escopo",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Quero criar uma tag",
        answers: { tagName: "QA-Tag", scope: "tracking" },
      });
      expectNoOrchestrator(turns);
      expectQuestionsHavePicker(turns);
      const tag = await prisma.tag.findFirst({
        where: { organizationId: context.qaOrg.organizationId, name: "QA-Tag" },
        select: { id: true },
      });
      expectThat(tag, `Não criou. Respostas: ${allReplyText(turns).slice(0, 300)}`);
    },
    cleanup: reseedAll,
  },
  {
    id: "F3-AGE-01",
    complexity: "N2",
    title: "Criar agenda: nome da frase → funil → duração",
    run: async (context) => {
      const vendas = await findTracking(context, "Vendas");
      expectThat(vendas, "Massa sem o funil Vendas.");
      const turns = await converse({
        context,
        firstMessage: "Cria a agenda QA Agenda",
        answers: { trackingName: buildPickedAnswer(vendas.name, vendas.id), slotDuration: "30" },
      });
      expectNoOrchestrator(turns);
      expectQuestionsHavePicker(turns);
      const agenda = await prisma.agenda.findFirst({
        where: { organizationId: context.qaOrg.organizationId, name: "QA Agenda" },
        select: { slotDuration: true },
      });
      expectThat(agenda?.slotDuration === 30, `Agenda: ${JSON.stringify(agenda)}. Respostas: ${allReplyText(turns).slice(0, 300)}`);
    },
    cleanup: reseedAll,
  },
  {
    id: "F3-AGE-02",
    complexity: "N2",
    title: "Remarcar pela frase",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Remarca a reunião da Maria Clara para sexta às 10h",
        answers: {},
      });
      expectNoOrchestrator(turns);
      const visit = await prisma.appointment.findFirst({
        where: { agenda: { organizationId: context.qaOrg.organizationId }, title: "Visita QA de amanhã" },
        select: { startsAt: true },
      });
      const expected = nextBrazilWeekday(5, 10, 0, context.startedAt);
      expectThat(
        visit?.startsAt.getTime() === expected.getTime(),
        `Horário: ${visit?.startsAt.toISOString()} (esperado ${expected.toISOString()}). Respostas: ${allReplyText(turns).slice(0, 300)}`,
      );
    },
    cleanup: reseedAll,
  },
  {
    id: "F3-AGE-03",
    complexity: "N2",
    title: "Cancelar compromisso pelo roteiro: busca",
    run: async (context) => {
      const meeting = await prisma.appointment.findFirstOrThrow({
        where: { agenda: { organizationId: context.qaOrg.organizationId }, title: "Reunião QA de hoje" },
        select: { id: true, title: true },
      });
      const turns = await converse({
        context,
        firstMessage: "Quero cancelar um compromisso",
        answers: { personName: buildPickedAnswer(meeting.title ?? "Reunião", meeting.id) },
      });
      expectNoOrchestrator(turns);
      expectQuestionsHavePicker(turns);
      const cancelled = await prisma.appointment.findUnique({ where: { id: meeting.id }, select: { status: true } });
      expectThat(cancelled?.status === "CANCELLED", `Situação: ${cancelled?.status}. Respostas: ${allReplyText(turns).slice(0, 300)}`);
    },
    cleanup: reseedAll,
  },
  {
    id: "F3-AGE-04",
    complexity: "N1",
    title: "Bloquear dia pela frase",
    run: async (context) => {
      const turns = await converse({ context, firstMessage: "Bloqueia o dia 30 na Agenda Comercial", answers: {} });
      expectNoOrchestrator(turns);
      const override = await prisma.agendaDateOverride.findFirst({
        where: { agenda: { organizationId: context.qaOrg.organizationId, name: "Agenda Comercial" } },
        select: { id: true },
      });
      expectThat(override, `Dia não bloqueado. Respostas: ${allReplyText(turns).slice(0, 300)}`);
    },
    cleanup: reseedAll,
  },
  {
    id: "F3-AGE-05",
    complexity: "N1",
    title: "Desativar agenda pela frase",
    run: async (context) => {
      const turns = await converse({ context, firstMessage: "Desativa a Agenda Suporte", answers: {} });
      expectNoOrchestrator(turns);
      const agenda = await prisma.agenda.findFirst({
        where: { organizationId: context.qaOrg.organizationId, name: "Agenda Suporte" },
        select: { isActive: true },
      });
      expectThat(agenda?.isActive === false, `Ainda ativa. Respostas: ${allReplyText(turns).slice(0, 300)}`);
    },
    cleanup: reseedAll,
  },
  {
    id: "F3-LEM-01",
    complexity: "N1",
    title: "Lembrete recorrente pela frase, sem pergunta",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Me lembra de ligar pra Maria Clara toda segunda às 9h",
        answers: {},
      });
      expectNoOrchestrator(turns);
      expectThat(turns.length === 1, `Perguntou algo: ${allReplyText(turns).slice(0, 300)}`);
      const reminder = await prisma.reminder.findFirst({
        where: { createdByUserId: context.qaOrg.ownerUserId, createdAt: { gte: context.startedAt } },
        select: { recurrenceType: true, remindTime: true },
      });
      expectThat(
        reminder?.recurrenceType === "WEEKLY" && reminder.remindTime === "09:00",
        `Lembrete: ${JSON.stringify(reminder)}. Respostas: ${allReplyText(turns).slice(0, 300)}`,
      );
    },
    cleanup: reseedAll,
  },
  {
    id: "F3-LEM-02",
    complexity: "N2",
    title: "Lembrete pelo roteiro: o quê → frequência → hora → dia",
    run: async (context) => {
      const startDay = brazilDateTime(2, 12, 0, context.startedAt);
      const turns = await converse({
        context,
        firstMessage: "Quero criar um lembrete",
        answers: {
          message: "Revisar metas QA",
          recurrence: "uma vez",
          remindTime: "10:00",
          firstRemindAt: formatPickedDate(brazilDateKey(startDay)),
        },
      });
      expectNoOrchestrator(turns);
      expectQuestionsHavePicker(turns);
      const reminder = await prisma.reminder.findFirst({
        where: { createdByUserId: context.qaOrg.ownerUserId, createdAt: { gte: context.startedAt } },
        select: { recurrenceType: true, message: true },
      });
      expectThat(
        reminder?.recurrenceType === "ONCE" && reminder.message === "Revisar metas QA",
        `Lembrete: ${JSON.stringify(reminder)}. Respostas: ${allReplyText(turns).slice(0, 300)}`,
      );
    },
    cleanup: reseedAll,
  },
];
