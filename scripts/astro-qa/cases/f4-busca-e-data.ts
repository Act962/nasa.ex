import prisma from "../../../src/lib/prisma";
import { buildPickedAnswer, buildPickedList, formatPickedDateTime } from "../../../src/features/astro/lib/astro-picker";
import { runSearch } from "../../../src/app/router/astro/search-entities";
import { brazilDateTime, formatBrazilDateTime } from "../brazil-time";
import {
  allReplyText,
  expectNoOrchestrator,
  expectQuestionsHavePicker,
  findSeedLead,
  converse,
  findCreatedAppointments,
  mentionsWeekday,
  removeCreatedSince,
} from "./qa-helpers";
import { expectReplyContains, expectThat, normalizeForMatch, replyOptionLabels, type QaCase } from "./types";

/** Próximo dia 5 às 10:00 de Brasília (se hoje já é 5 ou depois, no mês seguinte). */
function nextFifthAtTen(now: Date): Date {
  const [day, month, year] = now
    .toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    .split("/")
    .map(Number);
  const monthIndex = day < 5 ? month - 1 : month;
  return new Date(Date.UTC(year, monthIndex, 5, 13, 0, 0));
}

/** Respostas do roteiro de agenda: título e "onde" também são passos (spec 0033, RF-9). */
const SCHEDULE_STEP_ANSWERS = { confirmedTitle: "Reunião QA", meetingPlace: "Online" };
const AGENDA_ANSWER = { agendaName: "Agenda Comercial", leadName: "Maria Clara", ...SCHEDULE_STEP_ANSWERS };

/** Nada gravado e o ASTRO perguntou a hora. */
function asksTimeWithoutWriting(params: { id: string; title: string; message: string }): QaCase {
  return {
    id: params.id,
    complexity: "N2",
    title: params.title,
    run: async (context) => {
      const turns = await converse({ context, firstMessage: params.message, answers: AGENDA_ANSWER });
      const created = await findCreatedAppointments(context);
      expectThat(
        created.length === 0,
        `Gravou sem hora definida: ${created.map((appointment) => formatBrazilDateTime(appointment.startsAt)).join(", ")}`,
      );
      expectThat(
        /\bhora|horario/i.test(normalizeForMatch(allReplyText(turns))),
        `Não perguntou a hora. Respostas: ${allReplyText(turns).slice(0, 300)}`,
      );
    },
    cleanup: removeCreatedSince,
  };
}

export const F4_CASES: QaCase[] = [
  asksTimeWithoutWriting({
    id: "F4-01",
    title: "\"amanhã\" sem hora pergunta a hora (0033 CA-3)",
    message: "Marca uma reunião amanhã",
  }),
  {
    id: "F4-02",
    complexity: "N2",
    title: "Dois Kauê: busca mostra os dois (0033 CA-7)",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Marca reunião com o Kauê amanhã às 11h",
        answers: { agendaName: "Agenda Comercial" },
      });
      const leadQuestion = turns.find((turn) => turn.reply.actionResult?.status === "ambiguous" && turn.reply.actionResult.field === "leadName");
      const labels = leadQuestion ? replyOptionLabels(leadQuestion.reply) : [];
      expectThat(
        labels.some((label) => label.includes("Kauê Silva")) && labels.some((label) => label.includes("Kauê Souza")),
        `Esperava escolha entre Kauê Silva e Kauê Souza. Respostas: ${allReplyText(turns).slice(0, 300)}`,
      );
    },
    cleanup: removeCreatedSince,
  },
  {
    id: "F4-03",
    complexity: "N2",
    title: "Agenda com erro de digitação é sugerida (0033 CA-2)",
    run: async (context) => {
      const firstReply = await context.session.send("Marca reunião na Agenda Comerical amanhã às 11h");
      const labels = replyOptionLabels(firstReply);
      const created = await findCreatedAppointments(context);
      const suggested = labels[0] === "Agenda Comercial";
      const bookedRightAgenda = created.some((appointment) => appointment.agenda.name === "Agenda Comercial");
      expectThat(
        suggested || bookedRightAgenda,
        `Esperava "Agenda Comercial" sugerida no topo. Veio (${firstReply.actionResult?.status ?? firstReply.layer}): ${firstReply.text.slice(0, 200)}`,
      );
    },
    cleanup: removeCreatedSince,
  },
  {
    id: "F4-04",
    complexity: "N2",
    title: "\"dia 5\" vira data por extenso antes de gravar (0033 CA-6)",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Marca reunião dia 5 às 10h",
        answers: AGENDA_ANSWER,
      });
      const firstWriteIndex = turns.findIndex((turn) => turn.appointmentsCreatedSoFar > 0);
      const shownBeforeWrite = turns
        .slice(0, firstWriteIndex === -1 ? turns.length : firstWriteIndex)
        .some((turn) => mentionsWeekday(turn.reply.text));
      expectThat(shownBeforeWrite, `Não mostrou o dia da semana antes de gravar. Respostas: ${allReplyText(turns).slice(0, 300)}`);

      const [created] = await findCreatedAppointments(context);
      const expectedDay = nextFifthAtTen(context.startedAt);
      expectThat(created, "Não gravou o compromisso depois de confirmar.");
      expectThat(
        created.startsAt.getTime() === expectedDay.getTime(),
        `Esperava ${formatBrazilDateTime(expectedDay)}, gravou ${formatBrazilDateTime(created.startsAt)}.`,
      );
    },
    cleanup: removeCreatedSince,
  },
  asksTimeWithoutWriting({
    id: "F4-05",
    title: "\"segunda\" sem hora pergunta a hora (0033 CA-3)",
    message: "Marca reunião segunda",
  }),
  {
    id: "F4-06",
    complexity: "N2",
    title: "Horário ocupado avisa e oferece outro",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Marca reunião amanhã às 10h",
        answers: AGENDA_ANSWER,
      });
      const replies = normalizeForMatch(allReplyText(turns));
      expectThat((await findCreatedAppointments(context)).length === 0, "Gravou por cima de um compromisso.");
      expectThat(/ocupad/.test(replies), `Não avisou que está ocupado: ${replies.slice(0, 200)}`);
      expectThat(/livre|proximo horario|outro horario/.test(replies), `Não ofereceu outro horário: ${replies.slice(0, 200)}`);
    },
    cleanup: removeCreatedSince,
  },
  {
    id: "F4-14",
    complexity: "N2",
    title: "\"25h\" é recusado (0033 CA-4)",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Marca reunião amanhã às 25h",
        answers: AGENDA_ANSWER,
      });
      const created = await findCreatedAppointments(context);
      expectThat(
        created.length === 0,
        `Gravou hora inválida: ${created.map((appointment) => formatBrazilDateTime(appointment.startsAt)).join(", ")}. Respostas: ${allReplyText(turns).slice(0, 200)}`,
      );
    },
    cleanup: removeCreatedSince,
  },
  {
    id: "F4-15",
    complexity: "N2",
    title: "\"ontem\" avisa que é passado (0033 CA-5)",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Marca reunião ontem às 10h",
        answers: AGENDA_ANSWER,
      });
      const created = await findCreatedAppointments(context);
      expectThat(
        created.every((appointment) => appointment.startsAt > context.startedAt) || created.length === 0,
        "Gravou compromisso no passado.",
      );
      expectThat(
        /passad|ontem|ja passou/i.test(normalizeForMatch(allReplyText(turns))),
        `Não avisou que é passado: ${allReplyText(turns).slice(0, 200)}`,
      );
      expectThat(
        !created.some((appointment) => appointment.startsAt.getTime() === brazilDateTime(1, 10).getTime()),
        "Trocou \"ontem\" por amanhã sem perguntar.",
      );
    },
    cleanup: removeCreatedSince,
  },
  {
    id: "F4-16",
    complexity: "N2",
    title: "Pedido vago segue guiado até gravar (caso real)",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Quero marcar compromisso",
        answers: {
          answeredWhen: "amanhãs as 13h",
          agendaName: "Agenda Comercial",
          leadName: "Maria Clara",
          ...SCHEDULE_STEP_ANSWERS,
        },
      });
      const orchestratorTurn = turns.find((turn) => turn.reply.layer === "orquestrador");
      expectThat(
        !orchestratorTurn,
        `Caiu no orquestrador em "${orchestratorTurn?.userText}": ${orchestratorTurn?.reply.text.slice(0, 200)}`,
      );
      const [created] = await findCreatedAppointments(context);
      expectThat(created, `Não gravou. Respostas: ${allReplyText(turns).slice(0, 300)}`);
      const expectedStart = brazilDateTime(1, 13, 0, context.startedAt);
      expectThat(
        created.startsAt.getTime() === expectedStart.getTime(),
        `Esperava ${formatBrazilDateTime(expectedStart)}, gravou ${formatBrazilDateTime(created.startsAt)}.`,
      );
      expectThat(created.lead?.name === "Maria Clara", `Lead errado: ${created.lead?.name ?? "nenhum"}.`);
    },
    cleanup: removeCreatedSince,
  },
  {
    id: "F4-17",
    complexity: "N2",
    title: "Agenda e lead escolhidos no seletor, homônimo resolvido pelo id",
    run: async (context) => {
      const organizationId = context.qaOrg.organizationId;
      const [agenda, lead] = await Promise.all([
        prisma.agenda.findFirstOrThrow({ where: { organizationId, name: "Agenda Comercial" } }),
        prisma.lead.findFirstOrThrow({ where: { tracking: { organizationId }, name: "Kauê Souza" } }),
      ]);
      const turns = await converse({
        context,
        firstMessage: "Marca reunião com o Kauê amanhã às 11h",
        answers: {
          agendaName: buildPickedAnswer(agenda.name, agenda.id),
          leadName: buildPickedAnswer(`${lead.name} — Vendas`, lead.id),
          ...SCHEDULE_STEP_ANSWERS,
        },
      });
      expectQuestionsHavePicker(turns);
      const [created] = await findCreatedAppointments(context);
      expectThat(created, `Não gravou. Respostas: ${allReplyText(turns).slice(0, 300)}`);
      expectThat(created.leadId === lead.id, `Lead errado: ${created.lead?.name ?? "nenhum"}.`);
      expectThat(created.agenda.name === "Agenda Comercial", `Agenda errada: ${created.agenda.name}.`);
    },
    cleanup: removeCreatedSince,
  },
  {
    id: "F4-18",
    complexity: "N2",
    title: "Data e hora escolhidas no seletor, compromisso sem lead",
    run: async (context) => {
      const agenda = await prisma.agenda.findFirstOrThrow({
        where: { organizationId: context.qaOrg.organizationId, name: "Agenda Comercial" },
      });
      const chosenStart = brazilDateTime(2, 15, 0, context.startedAt);
      const [day, month, year] = chosenStart
        .toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
        .split("/");
      const turns = await converse({
        context,
        firstMessage: "Quero marcar compromisso",
        answers: {
          answeredWhen: formatPickedDateTime(`${year}-${month}-${day}`, "15:00"),
          agendaName: buildPickedAnswer(agenda.name, agenda.id),
          leadName: "sem lead",
          ...SCHEDULE_STEP_ANSWERS,
        },
      });
      expectQuestionsHavePicker(turns);
      const [created] = await findCreatedAppointments(context);
      expectThat(created, `Não gravou. Respostas: ${allReplyText(turns).slice(0, 300)}`);
      expectThat(
        created.startsAt.getTime() === chosenStart.getTime(),
        `Esperava ${formatBrazilDateTime(chosenStart)}, gravou ${formatBrazilDateTime(created.startsAt)}.`,
      );
      expectThat(created.leadId === null, `Não devia ter lead: ${created.lead?.name}.`);
    },
    cleanup: removeCreatedSince,
  },
  {
    id: "F4-19",
    complexity: "N2",
    title: "\"Quero criar uma agenda para amanhã às 13h com…\" vira roteiro, sem IA",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Quero criar uma agenda para amanhã as 13h com a Maria Clara",
        answers: { agendaName: "Agenda Comercial", leadName: "Maria Clara", ...SCHEDULE_STEP_ANSWERS },
      });
      const offRoadmapTurn = turns.find((turn) => turn.reply.layer === "orquestrador");
      expectThat(!offRoadmapTurn, `Caiu no orquestrador: ${offRoadmapTurn?.reply.text.slice(0, 200)}`);
      expectThat(
        turns[0].reply.key === "appointment.create",
        `Esperava o roteiro de compromisso, veio ${turns[0].reply.key ?? turns[0].reply.layer}.`,
      );
      expectQuestionsHavePicker(turns);
      const [created] = await findCreatedAppointments(context);
      expectThat(created, `Não gravou. Respostas: ${allReplyText(turns).slice(0, 300)}`);
      const expectedStart = brazilDateTime(1, 13, 0, context.startedAt);
      expectThat(
        created.startsAt.getTime() === expectedStart.getTime(),
        `Esperava ${formatBrazilDateTime(expectedStart)}, gravou ${formatBrazilDateTime(created.startsAt)}.`,
      );
      expectThat(created.lead?.name === "Maria Clara", `Lead errado: ${created.lead?.name ?? "nenhum"}.`);
    },
    cleanup: removeCreatedSince,
  },
  {
    id: "F4-10",
    complexity: "N2",
    title: "\"Maria\" com duas Marias vira busca com as duas",
    run: async (context) => {
      const firstReply = await context.session.send("Move o lead Maria para Ganho");
      const result = firstReply.actionResult;
      const labels = replyOptionLabels(firstReply);
      expectThat(
        result?.status === "ambiguous" && result.field === "leadName" && Boolean(result.picker),
        `Esperava busca de lead. Veio (${firstReply.layer}): ${firstReply.text.slice(0, 200)}`,
      );
      expectThat(
        labels.some((label) => label.includes("Maria Clara")) && labels.some((label) => label.includes("Maria Eduarda")),
        `Opções sem as duas Marias: ${labels.join(", ")}`,
      );
    },
    cleanup: removeCreatedSince,
  },
  {
    id: "F4-12",
    complexity: "N2",
    title: "Coluna inexistente vira escolha entre as colunas reais",
    run: async (context) => {
      const lead = await findSeedLead(context, "Maria Clara");
      const firstReply = await context.session.send("Move a Maria Clara para Fechado");
      const result = firstReply.actionResult;
      expectThat(
        result?.status === "ambiguous" && result.field === "statusName" && result.picker?.kind === "select",
        `Esperava seletor de colunas. Veio (${firstReply.layer}): ${firstReply.text.slice(0, 200)}`,
      );
      const labels = replyOptionLabels(firstReply);
      expectThat(
        ["Novo", "Qualificado", "Proposta", "Ganho", "Perdido"].every((column) => labels.includes(column)),
        `Colunas erradas: ${labels.join(", ")}`,
      );
      const unchanged = await findSeedLead(context, "Maria Clara");
      expectThat(unchanged?.statusId === lead?.statusId, "Moveu sem o usuário escolher.");
    },
    cleanup: removeCreatedSince,
  },
  {
    id: "F4-07",
    complexity: "N2",
    title: "Proposta pelo roteiro: uma pergunta por vez, cada uma com seletor",
    run: async (context) => {
      const organizationId = context.qaOrg.organizationId;
      const [client, consultoria] = await Promise.all([
        prisma.lead.findFirstOrThrow({ where: { tracking: { organizationId }, name: "Maria Clara" } }),
        prisma.forgeProduct.findFirstOrThrow({ where: { organizationId, name: "Consultoria" } }),
      ]);
      const turns = await converse({
        context,
        firstMessage: "Cria uma proposta",
        answers: {
          clientName: buildPickedAnswer(client.name, client.id),
          productName: buildPickedList([{ label: consultoria.name, id: consultoria.id, quantity: 1 }]),
          validUntil: "15 dias",
          confirmedTitle: "Proposta F4-07",
        },
      });
      expectNoOrchestrator(turns);
      expectQuestionsHavePicker(turns);
      const multiQuestion = turns.find(
        (turn) => turn.reply.actionResult?.status === "needs_input" && turn.reply.actionResult.missingFields.length > 1,
      );
      expectThat(!multiQuestion, `Perguntou mais de uma coisa de uma vez: ${multiQuestion?.reply.text}`);
      const created = await prisma.forgeProposal.findFirst({
        where: { organizationId, title: "Proposta F4-07" },
        select: { id: true },
      });
      expectThat(created, `Não criou. Respostas: ${allReplyText(turns).slice(0, 300)}`);
      await prisma.forgeProposalProduct.deleteMany({ where: { proposalId: created.id } });
      await prisma.forgeProposal.delete({ where: { id: created.id } });
    },
    cleanup: removeCreatedSince,
  },
  {
    id: "F4-08",
    complexity: "N2",
    title: "Mudar de assunto no meio do roteiro abandona o pedido e responde",
    run: async (context) => {
      const firstReply = await context.session.send("Cria uma proposta");
      expectThat(firstReply.actionResult?.status === "needs_input", `Não começou o roteiro: ${firstReply.text}`);
      const secondReply = await context.session.send("Quantos leads eu tenho?");
      expectThat(
        secondReply.layer === "consulta" && secondReply.key === "tracking.leads_count",
        `Não respondeu a consulta: [${secondReply.layer} ${secondReply.key}] ${secondReply.text.slice(0, 160)}`,
      );
      const thirdReply = await context.session.send("Maria Clara");
      expectThat(
        thirdReply.key !== "forge.create_proposal",
        "O roteiro da proposta continuou depois de mudar de assunto.",
      );
    },
    cleanup: removeCreatedSince,
  },
  {
    id: "F4-09",
    complexity: "N2",
    title: "\"Deixa pra lá\" cancela sem gravar",
    run: async (context) => {
      await context.session.send("Cria uma proposta");
      const reply = await context.session.send("deixa pra lá");
      expectReplyContains(reply, ["nada foi gravado"]);
      const created = await prisma.forgeProposal.count({
        where: { organizationId: context.qaOrg.organizationId, createdAt: { gte: context.startedAt } },
      });
      expectThat(created === 0, "Gravou proposta depois de cancelar.");
    },
    cleanup: removeCreatedSince,
  },
  {
    id: "F4-11",
    complexity: "N2",
    title: "Despesa sem valor: pergunta valor e vencimento, aceita \"R$ 1.250,50\" e \"dia 10\"",
    run: async (context) => {
      const organizationId = context.qaOrg.organizationId;
      const [banco, operacional] = await Promise.all([
        prisma.paymentBankAccount.findFirstOrThrow({ where: { organizationId, name: "Banco" } }),
        prisma.paymentCategory.findFirstOrThrow({ where: { organizationId, name: "Operacional" } }),
      ]);
      const turns = await converse({
        context,
        firstMessage: "Lança uma despesa de internet",
        answers: {
          amount: "R$ 1.250,50",
          dueDate: "dia 10",
          accountName: buildPickedAnswer(banco.name, banco.id),
          categoryName: buildPickedAnswer(operacional.name, operacional.id),
        },
        maxTurns: 8,
      });
      expectNoOrchestrator(turns);
      const created = await prisma.paymentEntry.findFirst({
        where: { organizationId, createdAt: { gte: context.startedAt } },
        select: { id: true, amount: true, description: true, dueDate: true },
      });
      expectThat(created, `Não lançou. Respostas: ${allReplyText(turns).slice(0, 300)}`);
      expectThat(created.amount === 125050, `Valor: ${created.amount}.`);
      expectThat(
        created.dueDate.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).endsWith("-10"),
        `Vencimento: ${created.dueDate.toISOString()}.`,
      );
      await prisma.paymentEntry.delete({ where: { id: created.id } });
    },
    cleanup: removeCreatedSince,
  },
  {
    id: "F4-13",
    complexity: "N2",
    title: "Com 12 agendas, a busca do seletor acha a que não está entre as opções",
    run: async (context) => {
      const organizationId = context.qaOrg.organizationId;
      const vendas = await prisma.tracking.findFirstOrThrow({ where: { organizationId, name: "Vendas" } });
      await prisma.agenda.createMany({
        data: Array.from({ length: 10 }, (_, index) => ({
          name: `Agenda Extra ${String(index + 1).padStart(2, "0")}`,
          slug: `agenda-extra-${index + 1}`,
          organizationId,
          trackingId: vendas.id,
        })),
      });
      const firstReply = await context.session.send("Marca reunião amanhã às 11h com a Maria Clara");
      const result = firstReply.actionResult;
      expectThat(
        result?.status === "ambiguous" && result.field === "agendaName" && result.picker?.kind === "entity",
        `Esperava a busca de agenda. Veio: ${firstReply.text.slice(0, 160)}`,
      );
      const initialLabels = result.options.map((option) => option.label);
      const searched = await runSearch("agenda", "Extra 10", organizationId, 12);
      const target = searched.find((row) => row.label === "Agenda Extra 10");
      expectThat(target, `A busca não achou "Agenda Extra 10": ${searched.map((row) => row.label).join(", ")}`);
      expectThat(
        initialLabels.length < 12,
        "Todas as 12 agendas couberam nas opções iniciais — o caso não prova a busca.",
      );
      const turns = await converse({
        context,
        firstMessage: buildPickedAnswer(target.label, target.id),
        answers: { leadName: "Maria Clara", confirmedTitle: "Reunião F4-13", meetingPlace: "Online" },
      });
      const [created] = await findCreatedAppointments(context);
      expectThat(
        created?.agenda.name === "Agenda Extra 10",
        `Gravou em ${created?.agenda.name ?? "lugar nenhum"}. Respostas: ${allReplyText(turns).slice(0, 300)}`,
      );
    },
    cleanup: async (context) => {
      await removeCreatedSince(context);
      await prisma.agenda.deleteMany({
        where: { organizationId: context.qaOrg.organizationId, name: { startsWith: "Agenda Extra" } },
      });
    },
  },
];
