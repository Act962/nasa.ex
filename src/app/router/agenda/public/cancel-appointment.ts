import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

/** Rota pública — sem autenticação. Permite que o lead cancele seu próprio compromisso. */
export const cancelPublicAppointment = base
  .route({ method: "POST", summary: "Cancel appointment (public)", tags: ["Agenda"] })
  .input(z.object({ appointmentId: z.string() }))
  .handler(async ({ input, errors }) => {
    const appointment = await prisma.appointment.findUnique({
      where: { id: input.appointmentId },
    });

    if (!appointment) throw errors.NOT_FOUND({ message: "Agendamento não encontrado" });
    if (appointment.status === "CANCELLED")
      throw errors.BAD_REQUEST({ message: "Agendamento já cancelado" });

    const updated = await prisma.appointment.update({
      where: { id: input.appointmentId },
      data: { status: "CANCELLED", cancelledBy: "CLIENT" },
    });

    return { appointment: updated };
  });
