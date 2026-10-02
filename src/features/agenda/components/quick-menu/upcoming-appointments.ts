import dayjs from "dayjs";
import type { QuickMenuAppointment } from "./quick-menu-types";

const INACTIVE_STATUSES = new Set(["CANCELLED", "CANCELED", "DONE", "COMPLETED"]);

/** Próximos compromissos com lead, do mais perto ao mais longe (cancelados e concluídos ficam fora). */
export function upcomingAppointmentsWithLead(appointments: QuickMenuAppointment[], limit = 20): QuickMenuAppointment[] {
  const now = dayjs();
  return appointments
    .filter((appointment) => appointment.lead && !INACTIVE_STATUSES.has(appointment.status))
    .filter((appointment) => dayjs(appointment.endsAt).isAfter(now))
    .sort((first, second) => dayjs(first.startsAt).valueOf() - dayjs(second.startsAt).valueOf())
    .slice(0, limit);
}

export function formatAppointmentWhen(appointment: QuickMenuAppointment): string {
  const startsAt = dayjs(appointment.startsAt);
  const dayLabel = startsAt.isSame(dayjs(), "day")
    ? "Hoje"
    : startsAt.isSame(dayjs().add(1, "day"), "day")
      ? "Amanhã"
      : startsAt.format("ddd, DD/MM");
  return `${dayLabel} às ${startsAt.format("HH:mm")}`;
}
