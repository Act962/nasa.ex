import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import type { AiCapabilities } from "./capabilities";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Lembrete antes do horário (spec 0084, Parte E). Reaproveita os lembretes do
 * sistema: um `Reminder` de envio único, que a função `processReminder` já
 * sabe esperar e enviar. Sem tabela nem coluna nova: o lembrete de um
 * agendamento é achado pelo cliente e pelo horário em que vai tocar.
 */

const BRAZIL_TIME_ZONE = "America/Sao_Paulo";
const HOUR_MS = 60 * 60_000;
const DETAIL_START = "Lembrete: ";
const DETAIL_END = ". Responda";
/** Cliente que pediu para parar recebe esta tag; com ela, nenhum lembrete é criado. */
export const NO_REMINDER_TAG_SLUG = "sem-lembretes";

export interface AppointmentReminderScope {
  organizationId: string;
  trackingId: string;
  leadId: string;
  leadPhone: string | null;
  reminder: AiCapabilities["reminder"];
  /** Membro que configurou o agente: é o autor do lembrete. */
  configuredByUserId: string | null;
}

function remindAtFor(startsAt: Date, hoursBefore: number): Date {
  return new Date(startsAt.getTime() - hoursBefore * HOUR_MS);
}

function buildReminderMessage(agendaName: string, startsAt: Date): string {
  const when = dayjs(startsAt).tz(BRAZIL_TIME_ZONE);
  return (
    `Olá, {{nome}}! ${DETAIL_START}${agendaName} em ${when.format("DD/MM")} às ${when.format("HH:mm")}` +
    `${DETAIL_END} *confirmar* ou *remarcar*. Para não receber mais lembretes, responda *parar*.`
  );
}

/** "Consulta em 12/10 às 14:00" — a variável {{2}} do template usado fora da janela de 24 h. */
export function extractReminderDetail(message: string): string | null {
  const start = message.indexOf(DETAIL_START);
  const end = message.indexOf(DETAIL_END);
  if (start === -1 || end <= start) return null;
  return message.slice(start + DETAIL_START.length, end).trim() || null;
}

async function hasOptedOut(scope: AppointmentReminderScope): Promise<boolean> {
  const optOut = await prisma.leadTag.findFirst({
    where: { leadId: scope.leadId, tag: { organizationId: scope.organizationId, slug: NO_REMINDER_TAG_SLUG } },
    select: { leadId: true },
  });
  return Boolean(optOut);
}

/** Um lembrete por agendamento (RF-20). Não cria se já passou da hora de lembrar. */
export async function createAppointmentReminder(
  scope: AppointmentReminderScope,
  appointment: { startsAt: Date; agendaName: string },
): Promise<{ created: boolean }> {
  if (!scope.reminder.isEnabled || !scope.configuredByUserId || !scope.leadPhone) return { created: false };
  const remindAt = remindAtFor(appointment.startsAt, scope.reminder.hoursBefore);
  if (remindAt.getTime() <= Date.now()) return { created: false };
  if (await hasOptedOut(scope)) return { created: false };

  const reminder = await prisma.reminder.create({
    data: {
      createdByUserId: scope.configuredByUserId,
      message: buildReminderMessage(appointment.agendaName, appointment.startsAt),
      recurrenceType: "ONCE",
      remindTime: dayjs(remindAt).tz(BRAZIL_TIME_ZONE).format("HH:mm"),
      nextRemindAt: remindAt,
      notifyPhone: scope.leadPhone,
      leadId: scope.leadId,
      trackingId: scope.trackingId,
    },
    select: { id: true },
  });
  await inngest
    .send({ name: "reminder/created", data: { reminderId: reminder.id } })
    .catch((error: unknown) => console.warn("[tracking-chat-ai/lembrete] agendamento do lembrete falhou", error));
  return { created: true };
}

/** Agendamento cancelado ou remarcado: o lembrete do horário antigo deixa de valer. */
export async function cancelAppointmentReminder(scope: AppointmentReminderScope, startsAt: Date): Promise<void> {
  if (!scope.configuredByUserId) return;
  await prisma.reminder.updateMany({
    where: {
      leadId: scope.leadId,
      createdByUserId: scope.configuredByUserId,
      recurrenceType: "ONCE",
      isActive: true,
      nextRemindAt: remindAtFor(startsAt, scope.reminder.hoursBefore),
    },
    data: { isActive: false },
  });
}

/** "Parar": marca o cliente e desliga os lembretes que ainda iam tocar (RF-19). */
export async function stopLeadReminders(scope: AppointmentReminderScope): Promise<void> {
  const tag =
    (await prisma.tag.findFirst({
      where: { organizationId: scope.organizationId, slug: NO_REMINDER_TAG_SLUG },
      select: { id: true },
    })) ??
    (await prisma.tag.create({
      data: { organizationId: scope.organizationId, slug: NO_REMINDER_TAG_SLUG, name: "Sem lembretes", color: "#6B7280", type: "SYSTEM" },
      select: { id: true },
    }));
  await prisma.leadTag.createMany({ data: [{ leadId: scope.leadId, tagId: tag.id }], skipDuplicates: true });
  await prisma.reminder.updateMany({
    where: { leadId: scope.leadId, recurrenceType: "ONCE", isActive: true, notifyPhone: scope.leadPhone ?? undefined, nextRemindAt: { gt: new Date() } },
    data: { isActive: false },
  });
}
