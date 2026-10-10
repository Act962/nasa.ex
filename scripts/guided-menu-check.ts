// Confere o menu de botões do cliente (spec 0089) no banco de desenvolvimento, sem enviar nada ao WhatsApp.
// Rodar: pnpm tsx --conditions=react-server scripts/guided-menu-check.ts <organizationId> <trackingId> <leadId>
import "./astro-qa/load-env";
import prisma from "../src/lib/prisma";
import { loadAgentContext } from "../src/features/tracking-chat-ai/lib/context";
import { handleGuidedMenu, type GuidedMenuChannel } from "../src/features/tracking-chat-ai/lib/guided-menu/guided-menu";
import { clientMenuId } from "../src/features/tracking-chat-ai/lib/guided-menu/menu-ids";

const [organizationId, trackingId, leadId] = process.argv.slice(2);
const TEST_PREFIX = "guided-check-";
let failures = 0;
function check(label: string, isOk: boolean, detail = "") {
  if (!isOk) failures += 1;
  console.log(`${isOk ? "ok   " : "FALHA"} ${label}${detail ? ` · ${detail}` : ""}`);
}

interface SentMessage {
  body: string;
  options: { id: string; text: string }[];
}
const sent: SentMessage[] = [];
let sendCounter = 0;
const fakeChannel: GuidedMenuChannel = {
  sendButtons: async (_phone, payload) => {
    sent.push({ body: payload.bodyText, options: payload.buttons.map((button) => ({ id: button.id, text: button.text })) });
    return { messageId: `${TEST_PREFIX}out-${Date.now()}-${(sendCounter += 1)}` };
  },
  sendText: async (_phone, text) => {
    sent.push({ body: text, options: [] });
    return { messageId: `${TEST_PREFIX}out-${Date.now()}-${(sendCounter += 1)}` };
  },
};

async function main() {
  const conversation = await prisma.conversation.findFirstOrThrow({ where: { leadId }, select: { id: true } });
  let inboundCounter = 0;
  async function act(input: { text?: string; clickId?: string }): Promise<{ handled: boolean; last: SentMessage | undefined }> {
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        messageId: `${TEST_PREFIX}in-${Date.now()}-${(inboundCounter += 1)}`,
        fromMe: false,
        body: input.text ?? "clique",
        senderName: "Verificação",
        ...(input.clickId ? { metadata: { interactiveReplyId: input.clickId } } : {}),
      },
      select: { id: true },
    });
    const ctx = await loadAgentContext({ trackingId, leadId, conversationId: conversation.id, messageId: message.id, organizationId });
    const before = sent.length;
    const result = await handleGuidedMenu(ctx, message.id, fakeChannel);
    return { handled: result.handled, last: sent.length > before ? sent[sent.length - 1] : undefined };
  }
  const optionId = (message: SentMessage | undefined, text: string) => message?.options.find((option) => option.text.startsWith(text))?.id ?? "";

  const runsBefore = await prisma.aiChatRun.count({ where: { leadId } });

  const freeText = await act({ text: "Vocês atendem Unimed?" });
  check("CA-6 texto livre vai para a assistente", !freeText.handled);
  const greeting = await act({ text: "Oi!" });
  check("CA-1 saudação abre o menu", greeting.handled && Boolean(optionId(greeting.last, "Agendar")), greeting.last?.options.map((option) => option.text).join(" | "));

  const agendas = await act({ clickId: optionId(greeting.last, "Agendar") });
  check("Agendar lista as agendas liberadas", (agendas.last?.options.length ?? 0) >= 1, agendas.last?.options.map((option) => option.text).join(" | "));
  const days = await act({ clickId: agendas.last?.options[0]?.id });
  check("Agenda escolhida lista dias com vaga", (days.last?.options.length ?? 0) >= 2, days.last?.options.slice(0, 4).map((option) => option.text).join(" | "));
  const slots = await act({ clickId: days.last?.options[0]?.id });
  check("Dia escolhido lista horários", (slots.last?.options.length ?? 0) >= 2, slots.last?.options.slice(0, 5).map((option) => option.text).join(" | "));
  const summary = await act({ clickId: slots.last?.options[0]?.id });
  check("Horário escolhido pede confirmação", Boolean(optionId(summary.last, "Confirmar")), summary.last?.body.replace(/\n/g, " / "));

  const appointmentsBefore = await prisma.appointment.count({ where: { leadId, status: { not: "CANCELLED" } } });
  const giveUp = await act({ clickId: optionId(summary.last, "Cancelar") });
  const appointmentsAfterGiveUp = await prisma.appointment.count({ where: { leadId, status: { not: "CANCELLED" } } });
  check("CA-3 cancelar no resumo não marca nada", giveUp.handled && appointmentsAfterGiveUp === appointmentsBefore);

  const booked = await act({ clickId: optionId(summary.last, "Confirmar") });
  const appointment = await prisma.appointment.findFirst({ where: { leadId, status: { not: "CANCELLED" }, startsAt: { gte: new Date() } }, orderBy: { createdAt: "desc" }, select: { id: true } });
  check("CA-2 confirmar marca o horário", Boolean(appointment) && Boolean(booked.last?.body.startsWith("Marcado")), booked.last?.body.split("\n")[0]);
  const bookedAgain = await act({ clickId: optionId(summary.last, "Confirmar") });
  const duplicates = await prisma.appointment.count({ where: { leadId, status: { not: "CANCELLED" }, startsAt: { gte: new Date() } } });
  check("CB-4 segundo clique em confirmar não duplica", duplicates === appointmentsBefore + 1, bookedAgain.last?.body);

  const mine = await act({ clickId: clientMenuId({ step: "mine" }) });
  check("Meus horários lista o agendamento", (mine.last?.options.length ?? 0) >= 2, mine.last?.options.map((option) => option.text).join(" | "));
  const detail = await act({ clickId: mine.last?.options[0]?.id });
  check("Agendamento oferece remarcar e cancelar", Boolean(optionId(detail.last, "Remarcar")) && Boolean(optionId(detail.last, "Cancelar")));

  const rescheduleDays = await act({ clickId: optionId(detail.last, "Remarcar") });
  const rescheduleSlots = await act({ clickId: rescheduleDays.last?.options[1]?.id ?? rescheduleDays.last?.options[0]?.id });
  const rescheduleSummary = await act({ clickId: rescheduleSlots.last?.options[1]?.id });
  const rescheduled = await act({ clickId: optionId(rescheduleSummary.last, "Confirmar") });
  check("CA-5 remarcar por cliques muda o horário", Boolean(rescheduled.last?.body.startsWith("Remarcado")), rescheduled.last?.body);

  const otherAppointment = await prisma.appointment.findFirst({ where: { leadId: { not: leadId }, status: { not: "CANCELLED" } }, select: { id: true } });
  if (otherAppointment) {
    const forgedCancel = await act({ clickId: clientMenuId({ step: "cancelConfirm", appointmentId: otherAppointment.id }) });
    const stillThere = await prisma.appointment.findUnique({ where: { id: otherAppointment.id }, select: { status: true } });
    check("CA-8 agendamento de outro cliente não é cancelado", stillThere?.status !== "CANCELLED" && Boolean(forgedCancel.last?.body.includes("não está mais disponível")));
  }
  const otherAgenda = await prisma.agenda.findFirst({ where: { organizationId: { not: organizationId } }, select: { id: true } });
  if (otherAgenda) {
    const forgedDays = await act({ clickId: clientMenuId({ step: "days", agendaId: otherAgenda.id, appointmentId: null }) });
    check("CA-8 agenda de outra empresa é recusada", Boolean(forgedDays.last?.body.includes("não está mais disponível")), forgedDays.last?.body);
  }
  const malformed = await act({ clickId: "cli:confirm|x|não-é-data|25:99|-" });
  check("Id malformado volta ao menu, sem erro", malformed.handled && Boolean(optionId(malformed.last, "Agendar")));

  if (appointment) {
    const askCancel = await act({ clickId: clientMenuId({ step: "cancel", appointmentId: appointment.id }) });
    const cancelled = await act({ clickId: optionId(askCancel.last, "Confirmar") });
    const final = await prisma.appointment.findUnique({ where: { id: appointment.id }, select: { status: true } });
    check("CA-4 cancelar por cliques cancela o agendamento certo", final?.status === "CANCELLED", cancelled.last?.body);
  }

  const human = await act({ clickId: clientMenuId({ step: "human" }) });
  const leadAfterHuman = await prisma.lead.findUnique({ where: { id: leadId }, select: { isActive: true } });
  check("Falar com atendente pausa a assistente", human.handled && leadAfterHuman?.isActive === false, human.last?.body);

  const runsAfter = await prisma.aiChatRun.count({ where: { leadId } });
  check("CA-13 nenhuma resposta de IA foi gerada nem cobrada", runsAfter === runsBefore, `${runsAfter - runsBefore} execuções`);

  // Limpeza: tira da conversa o que esta verificação gravou e devolve o lead ao estado de antes.
  const removed = await prisma.message.deleteMany({ where: { conversationId: conversation.id, messageId: { startsWith: TEST_PREFIX } } });
  await prisma.lead.update({ where: { id: leadId }, data: { isActive: true } });
  console.log(`limpeza: ${removed.count} mensagens de verificação removidas, lead reativado`);
  console.log(failures === 0 ? "TUDO CERTO" : `${failures} FALHA(S)`);
}
main().then(() => process.exit(failures === 0 ? 0 : 1), (error) => { console.error(error); process.exit(1); });
