import { inngest } from "@/inngest/client";
import {
  APPOINTMENT_WATCH_EVENT,
  expireScheduledTag,
  openAppointmentCheck,
  recheckAppointment,
  type AppointmentWatchEventData,
} from "@/features/org-defaults/lib/attendance/appointment";

// Agendamento no atendimento (spec 0113, RF-17 e RF-18): dorme até o horário, abre a conferência da equipe e,
// passado o fim, tira "Agendado". O "Não" da equipe volta aqui como `recheck`, 10 min depois.

// O plano gratuito do Inngest limita cada espera a 7 dias: agendamento mais distante espera em trechos.
const MAX_SLEEP_MS = 6 * 24 * 60 * 60_000;

export const appointmentWatch = inngest.createFunction(
  {
    id: "org-defaults-appointment-watch",
    retries: 2,
    concurrency: [{ key: "event.data.appointmentId", limit: 1 }],
  },
  { event: APPOINTMENT_WATCH_EVENT },
  async ({ event, step }) => {
    const data = event.data as AppointmentWatchEventData;
    if (data.stage === "recheck") {
      if (data.dueAt) await step.sleepUntil("aguarda-nova-conferencia", new Date(data.dueAt));
      return step.run("pergunta-de-novo", () => recheckAppointment(data));
    }
    const isBeyondMaxSleep = await step.run(
      "confere-distancia",
      () => new Date(data.startsAt).getTime() - Date.now() > MAX_SLEEP_MS,
    );
    if (isBeyondMaxSleep) {
      await step.sleep("aguarda-trecho", "6d");
      await step.sendEvent("continua-espera", { name: APPOINTMENT_WATCH_EVENT, data });
      return { action: "next_hop" };
    }
    await step.sleepUntil("aguarda-horario", new Date(data.startsAt));
    const opened = await step.run("abre-conferencia", () => openAppointmentCheck(data));
    if (opened.action === "rescheduled" || opened.action === "no_lead") return opened;
    await step.sleepUntil("aguarda-fim", new Date(data.endsAt));
    return step.run("tira-agendado", () => expireScheduledTag(data));
  },
);
