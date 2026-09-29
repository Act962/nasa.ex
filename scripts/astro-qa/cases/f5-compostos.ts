import { formatBrazilDateTime, nextBrazilWeekday } from "../brazil-time";
import {
  allReplyText,
  converse,
  findCreatedAppointments,
  findCreatedReminders,
  mentionsWeekday,
  removeCreatedSince,
} from "./qa-helpers";
import { expectThat, normalizeForMatch, type QaCase } from "./types";
import { F5_PLAN_CASES } from "./f5-planos";

export const F5_CASES: QaCase[] = [
  {
    id: "F5-AGE-01",
    complexity: "N3",
    title: "Consulta segunda 14h + aviso no WhatsApp (caso real, 0033 CA-8)",
    run: async (context) => {
      const turns = await converse({
        context,
        firstMessage:
          "Marque na agenda uma consulta para segunda feira as 14h e me mande uma notificação para meu WhatsApp 86998221810",
        answers: {
          agendaName: "Agenda Comercial",
          leadName: "Maria Clara",
          confirmedTitle: "Consulta com Maria Clara",
          meetingPlace: "Presencial",
        },
      });
      const transcript = allReplyText(turns);

      const askedLead = turns.some(
        (turn) =>
          turn.reply.actionResult?.status !== "done" &&
          /com quem|lead|cliente/i.test(normalizeForMatch(turn.reply.text)),
      );
      expectThat(askedLead, `Não perguntou com quem é a consulta (L5). Respostas: ${transcript.slice(0, 300)}`);

      const firstWriteIndex = turns.findIndex((turn) => turn.appointmentsCreatedSoFar > 0);
      const planShownBeforeWrite = turns
        .slice(0, firstWriteIndex === -1 ? turns.length : firstWriteIndex)
        .some((turn) => mentionsWeekday(turn.reply.text) && /whats/i.test(turn.reply.text));
      expectThat(
        planShownBeforeWrite,
        `Não mostrou o plano (data por extenso + aviso) antes de gravar (L3/L4). Respostas: ${transcript.slice(0, 300)}`,
      );

      const expectedStart = nextBrazilWeekday(1, 14, 0, context.startedAt);
      const [created] = await findCreatedAppointments(context);
      expectThat(created, "Não gravou a consulta.");
      expectThat(
        created.startsAt.getTime() === expectedStart.getTime(),
        `Esperava ${formatBrazilDateTime(expectedStart)}, gravou ${formatBrazilDateTime(created.startsAt)}.`,
      );
      expectThat(created.agenda.name === "Agenda Comercial", `Agenda errada: ${created.agenda.name}.`);
      expectThat(created.lead?.name === "Maria Clara", `Lead errado ou ausente: ${created.lead?.name ?? "nenhum"}.`);

      // A org de QA não tem WhatsApp conectado: o certo é dizer que não
      // consegue avisar, nunca sumir com essa parte do pedido.
      const reminders = await findCreatedReminders(context);
      const reportedWhatsApp = /whats/i.test(transcript);
      expectThat(
        reminders.some((reminder) => reminder.notifyPhone === "5586998221810") || reportedWhatsApp,
        "A parte do WhatsApp sumiu: nem lembrete, nem aviso de que não dá.",
      );
    },
    cleanup: removeCreatedSince,
  },
  ...F5_PLAN_CASES,
];
