import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { z } from "zod";

dayjs.extend(utc);
dayjs.extend(timezone);

export const rescheduleAppointment = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Reschedule an appointment via drag and drop",
    tags: ["Agenda"],
  })
  .input(
    z.object({
      appointmentId: z.string().min(1),
      startsAt: z.string().min(1), // ISO string
      endsAt: z.string().min(1),   // ISO string
    }),
  )
  .handler(async ({ input, context, errors }) => {
    // Verifica que o appointment pertence à organização
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: input.appointmentId,
        agenda: { organizationId: context.org.id },
        status: { notIn: ["CANCELLED"] },
      },
      select: { id: true, agendaId: true, endsAt: true, startsAt: true },
    });

    if (!appointment) {
      throw errors.NOT_FOUND({ message: "Agendamento não encontrado" });
    }

    const newStart = new Date(input.startsAt);
    const newEnd   = new Date(input.endsAt);

    // Verifica conflito no novo horário (ignora o próprio)
    const conflict = await prisma.appointment.findFirst({
      where: {
        id: { not: input.appointmentId },
        agendaId: appointment.agendaId,
        status: { notIn: ["CANCELLED"] },
        startsAt: { lt: newEnd },
        endsAt:   { gt: newStart },
      },
    });

    if (conflict) {
      throw errors.BAD_REQUEST({ message: "Já existe um agendamento neste horário." });
    }

    const updated = await prisma.appointment.update({
      where: { id: input.appointmentId },
      data: { startsAt: newStart, endsAt: newEnd },
    });

    return { appointment: updated };
  });
