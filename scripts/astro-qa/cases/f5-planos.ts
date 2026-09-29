import prisma from "../../../src/lib/prisma";
import { buildPickedAnswer } from "../../../src/features/astro/lib/astro-picker";
import { brazilDateTime, formatBrazilDateTime, nextBrazilWeekday, startOfBrazilDay } from "../brazil-time";
import { allReplyText, converse, expectNoOrchestrator, findCreatedAppointments, type ConversationTurn } from "./qa-helpers";
import { reseedAll } from "./f3-other-verbs";
import { expectThat, type QaCase, type QaCaseContext } from "./types";

// Pedidos compostos (docs/astro-bateria-de-testes.md, F5; spec 0033, RF-6/RF-7):
// o pedido vira plano, cada parte passa pelo roteiro, um cartão confirma tudo
// e cada parte volta ✅, ❌ ou ⏸ — nada some em silêncio.

function planCardOf(turns: ConversationTurn[]) {
  const turn = turns.find((candidate) => /^Confirmar plano/.test(candidate.reply.text));
  expectThat(turn, `Não mostrou o cartão do plano. Respostas: ${allReplyText(turns).slice(0, 400)}`);
  return turn.reply;
}

function reportOf(turns: ConversationTurn[]): string {
  const turn = [...turns].reverse().find((candidate) => candidate.reply.layer === "cartao");
  expectThat(turn, `O plano não foi executado. Respostas: ${allReplyText(turns).slice(0, 400)}`);
  return turn.reply.text;
}

function expectPartLine(lines: { value: string }[] | undefined, index: number, pattern: RegExp, context: string): void {
  const value = lines?.[index]?.value ?? "";
  expectThat(pattern.test(value), `Parte ${index + 1}: "${value}" (esperado ${pattern}). ${context.slice(0, 300)}`);
}

async function pickAgenda(context: QaCaseContext, name: string): Promise<string> {
  const agenda = await prisma.agenda.findFirstOrThrow({
    where: { organizationId: context.qaOrg.organizationId, name },
    select: { id: true, name: true },
  });
  return buildPickedAnswer(agenda.name, agenda.id);
}

async function pickTracking(context: QaCaseContext, name: string): Promise<string> {
  const tracking = await prisma.tracking.findFirstOrThrow({
    where: { organizationId: context.qaOrg.organizationId, name },
    select: { id: true, name: true },
  });
  return buildPickedAnswer(tracking.name, tracking.id);
}

async function findLeadByName(context: QaCaseContext, name: string) {
  return prisma.lead.findFirst({
    where: { tracking: { organizationId: context.qaOrg.organizationId }, name },
    select: {
      id: true,
      phone: true,
      status: { select: { name: true } },
      leadTags: { select: { tag: { select: { name: true } } } },
    },
  });
}

async function latestProposal(context: QaCaseContext) {
  return prisma.forgeProposal.findFirst({
    where: { organizationId: context.qaOrg.organizationId, createdAt: { gte: context.startedAt } },
    orderBy: { createdAt: "desc" },
    select: { discount: true, discountType: true, client: { select: { name: true } }, products: { select: { product: { select: { name: true } } } } },
  });
}

export const F5_PLAN_CASES: QaCase[] = [
  {
    id: "F5-AGE-02",
    complexity: "N3",
    title: "Reunião + link ao lead: plano com a parte do WhatsApp explicada",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Marca reunião com a Maria Clara quinta às 15h e manda o link da reunião pra ela",
        answers: {
          agendaName: await pickAgenda(context, "Agenda Comercial"),
          confirmedTitle: "Reunião com Maria Clara",
          meetingPlace: "Online",
        },
      });
      expectNoOrchestrator(turns);
      const card = planCardOf(turns);
      expectThat(card.confirmationLines?.length === 2, `Plano com ${card.confirmationLines?.length} partes.`);
      expectPartLine(card.confirmationLines, 1, /whats/i, allReplyText(turns));
      const [created] = await findCreatedAppointments(context);
      const expected = nextBrazilWeekday(4, 15, 0, context.startedAt);
      expectThat(created?.startsAt.getTime() === expected.getTime(), `Compromisso: ${created ? formatBrazilDateTime(created.startsAt) : "nenhum"}.`);
      expectThat(created.lead?.name === "Maria Clara", `Lead: ${created.lead?.name ?? "nenhum"}.`);
      expectThat(/✅/.test(reportOf(turns)), `Relatório sem ✅: ${reportOf(turns).slice(0, 300)}`);
    },
    cleanup: reseedAll,
  },
  {
    id: "F5-AGE-03",
    complexity: "N3",
    title: "Remarcar + avisar no WhatsApp",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Remarca a reunião da Maria Clara para sexta às 10h e avisa ela no WhatsApp",
        answers: {},
      });
      expectNoOrchestrator(turns);
      const card = planCardOf(turns);
      expectThat(card.confirmationLines?.length === 2, `Plano com ${card.confirmationLines?.length} partes.`);
      expectPartLine(card.confirmationLines, 1, /whats/i, allReplyText(turns));
      const visit = await prisma.appointment.findFirst({
        where: { agenda: { organizationId: context.qaOrg.organizationId }, title: "Visita QA de amanhã" },
        select: { startsAt: true },
      });
      const expected = nextBrazilWeekday(5, 10, 0, context.startedAt);
      expectThat(visit?.startsAt.getTime() === expected.getTime(), `Horário: ${visit ? formatBrazilDateTime(visit.startsAt) : "?"}.`);
    },
    cleanup: reseedAll,
  },
  {
    id: "F5-LEAD-01",
    complexity: "N3",
    title: "Criar lead + tag + mover: 3 partes com ✅",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Cria o lead Teste QA 02, telefone 86 99999-0002, coloca a tag Quente e move para Qualificado",
        answers: { trackingName: await pickTracking(context, "Vendas") },
      });
      expectNoOrchestrator(turns);
      const card = planCardOf(turns);
      expectThat(card.confirmationLines?.length === 3, `Plano com ${card.confirmationLines?.length} partes.`);
      const report = reportOf(turns);
      expectThat((report.match(/✅/g) ?? []).length === 3, `Relatório: ${report.slice(0, 400)}`);
      const lead = await findLeadByName(context, "Teste QA 02");
      expectThat(lead, "Lead não criado.");
      expectThat(lead.status?.name === "Qualificado", `Etapa: ${lead.status?.name}.`);
      expectThat(lead.leadTags.some((leadTag) => leadTag.tag.name === "Quente"), "Sem a tag Quente.");
    },
    cleanup: reseedAll,
  },
  {
    id: "F5-LEAD-02",
    complexity: "N3",
    title: "Lead criado vira o lead da reunião",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Cria o lead Teste QA 03 e marca uma reunião com ele amanhã às 9h",
        answers: {
          trackingName: await pickTracking(context, "Vendas"),
          phone: "pular",
          agendaName: await pickAgenda(context, "Agenda Comercial"),
          confirmedTitle: "Reunião com Teste QA 03",
          meetingPlace: "Presencial",
        },
        maxTurns: 9,
      });
      expectNoOrchestrator(turns);
      planCardOf(turns);
      const lead = await findLeadByName(context, "Teste QA 03");
      expectThat(lead, `Lead não criado. Relatório: ${reportOf(turns).slice(0, 300)}`);
      const [created] = await findCreatedAppointments(context);
      expectThat(created, `Reunião não criada. Relatório: ${reportOf(turns).slice(0, 300)}`);
      expectThat(created.leadId === lead.id, `Reunião ligada a ${created.lead?.name ?? "ninguém"}.`);
      expectThat(created.startsAt.getTime() === brazilDateTime(1, 9, 0, context.startedAt).getTime(), `Horário: ${formatBrazilDateTime(created.startsAt)}.`);
    },
    cleanup: reseedAll,
  },
  {
    id: "F5-FRG-01",
    complexity: "N3",
    title: "Proposta com desconto dentro da regra + envio",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Cria proposta de Consultoria para a Maria Clara com 10% de desconto e manda pra ela",
        answers: { validUntil: "7 dias", confirmedTitle: "Proposta QA desconto" },
      });
      expectNoOrchestrator(turns);
      const card = planCardOf(turns);
      expectThat(card.confirmationLines?.length === 2, `Plano com ${card.confirmationLines?.length} partes.`);
      expectPartLine(card.confirmationLines, 0, /10%/, allReplyText(turns));
      const proposal = await latestProposal(context);
      expectThat(proposal, `Proposta não criada. ${reportOf(turns).slice(0, 300)}`);
      expectThat(proposal.client?.name === "Maria Clara", `Cliente: ${proposal.client?.name}.`);
      expectThat(Number(proposal.discount) === 10 && proposal.discountType === "PERCENTUAL", `Desconto: ${proposal.discount} ${proposal.discountType}.`);
    },
    cleanup: reseedAll,
  },
  {
    id: "F5-FRG-02",
    complexity: "N3",
    title: "Desconto acima da regra é recusado e oferece o teto",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Cria proposta com 20% de desconto para a Maria Clara",
        answers: { productName: "Consultoria", validUntil: "7 dias", discountPercent: "10", confirmedTitle: "Proposta QA teto" },
      });
      expectNoOrchestrator(turns);
      const refusal = turns.find((turn) => turn.reply.actionResult?.status === "needs_input" && turn.reply.actionResult.missingFields[0]?.key === "discountPercent");
      expectThat(refusal && /10%/.test(refusal.reply.text), `Não recusou os 20% citando a regra. Respostas: ${allReplyText(turns).slice(0, 400)}`);
      const proposal = await latestProposal(context);
      expectThat(proposal && Number(proposal.discount) === 10, `Proposta: ${JSON.stringify(proposal)}.`);
    },
    cleanup: reseedAll,
  },
  {
    id: "F5-FIN-01",
    complexity: "N3",
    title: "Lançamento + lembrete 2 dias antes do vencimento",
    run: async (context) => {
      const [caixa, operacional] = await Promise.all([
        prisma.paymentBankAccount.findFirstOrThrow({ where: { organizationId: context.qaOrg.organizationId, name: "Caixa" }, select: { id: true, name: true } }),
        prisma.paymentCategory.findFirstOrThrow({ where: { organizationId: context.qaOrg.organizationId, name: "Operacional" }, select: { id: true, name: true } }),
      ]);
      const turns = await converse({
        context,
        firstMessage: "Lança a conta de luz de R$ 300 vencendo dia 15 e me lembra 2 dias antes",
        answers: {
          type: "despesa",
          accountName: buildPickedAnswer(caixa.name, caixa.id),
          categoryName: buildPickedAnswer(operacional.name, operacional.id),
        },
        maxTurns: 9,
      });
      expectNoOrchestrator(turns);
      planCardOf(turns);
      const entry = await prisma.paymentEntry.findFirst({
        where: { organizationId: context.qaOrg.organizationId, createdAt: { gte: context.startedAt } },
        select: { amount: true, dueDate: true, description: true },
      });
      expectThat(entry && entry.amount === 30000, `Lançamento: ${JSON.stringify(entry)}. ${reportOf(turns).slice(0, 300)}`);
      const reminder = await prisma.reminder.findFirst({
        where: { createdByUserId: context.qaOrg.ownerUserId, createdAt: { gte: context.startedAt } },
        select: { nextRemindAt: true, message: true },
      });
      expectThat(reminder, `Lembrete não criado. ${reportOf(turns).slice(0, 300)}`);
      const dueDay = Number(entry.dueDate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit" }));
      const remindDay = Number(reminder.nextRemindAt?.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit" }));
      expectThat(dueDay === 15 && remindDay === 13, `Vence dia ${dueDay}, lembra dia ${remindDay}.`);
    },
    cleanup: reseedAll,
  },
  {
    id: "F5-FIN-02",
    complexity: "N3",
    title: "Dar baixa + comprovante inexistente é explicado",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Marca como paga a conta de internet e me manda o comprovante no WhatsApp",
        answers: {},
      });
      expectNoOrchestrator(turns);
      const card = planCardOf(turns);
      expectPartLine(card.confirmationLines, 1, /comprovante/i, allReplyText(turns));
      const entry = await prisma.paymentEntry.findFirst({
        where: { organizationId: context.qaOrg.organizationId, description: "Conta de internet" },
        select: { status: true },
      });
      expectThat(entry?.status === "PAID", `Situação: ${entry?.status}. ${reportOf(turns).slice(0, 300)}`);
    },
    cleanup: reseedAll,
  },
  {
    id: "F5-CRS-01",
    complexity: "N3",
    title: "Duas perguntas, dois números",
    run: async (context) => {
      const reply = await context.session.send("Quantos leads entraram hoje e quantos foram respondidos?");
      expectThat(reply.layer === "consulta", `Foi para ${reply.layer}: ${reply.text.slice(0, 200)}`);
      const createdToday = {
        tracking: { organizationId: context.qaOrg.organizationId },
        createdAt: { gte: startOfBrazilDay(0, context.startedAt) },
      };
      const [entered, answered] = await Promise.all([
        prisma.lead.count({ where: createdToday }),
        prisma.lead.count({ where: { ...createdToday, conversation: { messages: { some: { fromMe: true } } } } }),
      ]);
      expectThat(reply.text.includes(String(entered)) && reply.text.includes(`${answered} lead`), `Esperava ${entered} e ${answered}: ${reply.text}`);
    },
  },
  {
    id: "F5-CRS-02",
    complexity: "N3",
    title: "Busca do Kauê uma vez, reaproveitada nas duas partes",
    run: async (context) => {
      const kaue = await prisma.lead.findFirstOrThrow({
        where: { tracking: { organizationId: context.qaOrg.organizationId }, name: "Kauê Silva" },
        select: { id: true, name: true },
      });
      const turns = await converse({
        context,
        firstMessage: "Move o Kauê para Ganho e cria uma proposta de Setup para ele",
        answers: { leadName: buildPickedAnswer(kaue.name, kaue.id), validUntil: "7 dias", confirmedTitle: "Setup Kauê QA" },
      });
      expectNoOrchestrator(turns);
      const leadQuestions = turns.filter((turn) => {
        const result = turn.reply.actionResult;
        const field = result?.status === "ambiguous" ? result.field : result?.status === "needs_input" ? result.missingFields[0]?.key : null;
        return field === "leadName" || field === "clientName";
      });
      expectThat(leadQuestions.length === 1, `Perguntou o lead ${leadQuestions.length} vezes.`);
      const lead = await findLeadByName(context, "Kauê Silva");
      expectThat(lead?.status?.name === "Ganho", `Etapa: ${lead?.status?.name}. ${reportOf(turns).slice(0, 300)}`);
      const proposal = await latestProposal(context);
      expectThat(proposal?.client?.name === "Kauê Silva", `Proposta para ${proposal?.client?.name ?? "ninguém"}.`);
    },
    cleanup: reseedAll,
  },
  {
    id: "F5-CRS-03",
    complexity: "N3",
    title: "Funil + 3 etapas, na ordem",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Cria o funil Eventos com as etapas Inscrito, Confirmado e Presente",
        answers: {},
      });
      expectNoOrchestrator(turns);
      const tracking = await prisma.tracking.findFirst({
        where: { organizationId: context.qaOrg.organizationId, name: "Eventos" },
        select: { status: { select: { name: true, order: true }, orderBy: { order: "asc" } } },
      });
      expectThat(tracking, `Funil não criado. ${allReplyText(turns).slice(0, 300)}`);
      const names = tracking.status.map((status) => status.name);
      const positions = ["Inscrito", "Confirmado", "Presente"].map((name) => names.indexOf(name));
      expectThat(positions.every((position) => position >= 0) && positions[0] < positions[1] && positions[1] < positions[2], `Etapas: ${names.join(", ")}.`);
    },
    cleanup: reseedAll,
  },
  {
    id: "F5-FAIL-01",
    complexity: "N3",
    title: "Parte destrutiva pede confirmação separada",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Marca reunião amanhã às 16h e exclui o lead João Pedro",
        answers: {
          agendaName: await pickAgenda(context, "Agenda Comercial"),
          leadName: "sem lead",
          confirmedTitle: "Reunião interna QA",
          meetingPlace: "Presencial",
        },
        shouldConfirm: false,
      });
      expectNoOrchestrator(turns);
      const card = planCardOf(turns);
      expectPartLine(card.confirmationLines, 1, /confirma/i, allReplyText(turns));
      const afterPlan = await context.session.send(`confirmar ${card.pendingActionId}`);
      expectThat(afterPlan.isConfirmationCard && afterPlan.pendingActionId, `A exclusão não pediu cartão próprio: ${afterPlan.text.slice(0, 300)}`);
      const [created] = await findCreatedAppointments(context);
      expectThat(created, "A reunião não foi criada — dependeu da exclusão.");
      expectThat(await findLeadByName(context, "João Pedro"), "João Pedro foi excluído sem a confirmação própria.");
      await context.session.send(`cancelar ${afterPlan.pendingActionId}`);
      expectThat(await findLeadByName(context, "João Pedro"), "João Pedro sumiu depois de cancelar.");
    },
    cleanup: reseedAll,
  },
  {
    id: "F5-FAIL-02",
    complexity: "N3",
    title: "Parte do meio impossível: 1 ✅, 2 ❌ com motivo, 3 ✅",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage: "Cria o lead Teste QA 04, manda um e-mail pra ele e anota nele que veio do site",
        answers: { trackingName: await pickTracking(context, "Vendas"), phone: "pular" },
      });
      expectNoOrchestrator(turns);
      const card = planCardOf(turns);
      expectThat(card.confirmationLines?.length === 3, `Plano com ${card.confirmationLines?.length} partes.`);
      expectPartLine(card.confirmationLines, 1, /❌.*e-?mail/i, allReplyText(turns));
      const report = reportOf(turns);
      expectThat((report.match(/✅/g) ?? []).length === 2 && /❌/.test(report), `Relatório: ${report.slice(0, 400)}`);
      const lead = await findLeadByName(context, "Teste QA 04");
      expectThat(lead, "Lead não criado.");
      const note = await prisma.leadHistory.findFirst({
        where: { leadId: lead.id, createdAt: { gte: context.startedAt } },
        select: { id: true },
      });
      expectThat(note, "A anotação não foi gravada no lead criado.");
    },
    cleanup: reseedAll,
  },
  {
    id: "F5-WKS-01",
    complexity: "N3",
    title: "Tarefa com responsável achado por busca",
    run: async (context) => {
      const workspace = await prisma.workspace.findFirstOrThrow({
        where: { organizationId: context.qaOrg.organizationId, name: "Operação" },
        select: { id: true, name: true },
      });
      const turns = await converse({
        context,
        firstMessage: "Cria a tarefa revisar contrato da Maria Clara para amanhã e atribui ao Vendedor",
        answers: { workspaceName: buildPickedAnswer(workspace.name, workspace.id), priorityName: "MEDIUM" },
      });
      expectNoOrchestrator(turns);
      const task = await prisma.action.findFirst({
        where: { workspace: { organizationId: context.qaOrg.organizationId }, createdAt: { gte: context.startedAt } },
        select: { title: true, dueDate: true, responsibles: { select: { userId: true } } },
      });
      expectThat(task, `Tarefa não criada. Respostas: ${allReplyText(turns).slice(0, 400)}`);
      expectThat(/revisar contrato/i.test(task.title), `Título: ${task.title}.`);
      expectThat(task.responsibles.some((responsible) => responsible.userId === context.qaOrg.sellerUserId), "O Vendedor não ficou responsável.");
      const dueKey = task.dueDate?.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      expectThat(dueKey === brazilDateTime(1, 12, 0, context.startedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }), `Prazo: ${dueKey}.`);
    },
    cleanup: reseedAll,
  },
];
