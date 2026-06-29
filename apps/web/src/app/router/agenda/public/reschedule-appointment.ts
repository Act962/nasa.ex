import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

/** Rota pública — sem autenticação. Permite que o lead reagende seu próprio compromisso. */
export const reschedulePublicAppointment = base
  .route({ method: "POST", summary: "Reschedule appointment (public)", tags: ["Agenda"] })
  .input(
    z.object({
      appointmentId: z.string(),
      date: z.string(), // YYYY-MM-DD
      time: z.string(), // HH:mm
      timeZone: z.string().optional(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const appointment = await prisma.appointment.findUnique({
      where: { id: input.appointmentId },
      include: { agenda: { select: { id: true, slotDuration: true } } },
    });

    if (!appointment) throw errors.NOT_FOUND({ message: "Agendamento não encontrado" });
    if (appointment.status === "CANCELLED")
      throw errors.BAD_REQUEST({ message: "Agendamento cancelado não pode ser reagendado" });

    const startsAt = (dayjs as any).tz(
      `${input.date} ${input.time}`,
      input.timeZone || "America/Sao_Paulo",
    );
    const endsAt = startsAt.add(appointment.agenda.slotDuration, "minute");

    // Verifica conflito (ignora o próprio)
    const conflict = await prisma.appointment.findFirst({
      where: {
        id: { not: input.appointmentId },
        agendaId: appointment.agendaId,
        status: { notIn: ["CANCELLED"] },
        startsAt: { lt: endsAt.toDate() },
        endsAt: { gt: startsAt.toDate() },
      },
    });

    if (conflict) throw errors.BAD_REQUEST({ message: "Este horário já está ocupado." });

    const updated = await prisma.appointment.update({
      where: { id: input.appointmentId },
      data: {
        startsAt: startsAt.toDate(),
        endsAt: endsAt.toDate(),
        status: "CONFIRMED",
      },
    });

    return { appointment: updated };
  });
