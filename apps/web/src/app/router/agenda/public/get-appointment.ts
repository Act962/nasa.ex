import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

/** Rota pública — sem autenticação. Usado pela página de acompanhamento do lead. */
export const getPublicAppointment = base
  .route({ method: "GET", summary: "Get public appointment", tags: ["Agenda"] })
  .input(z.object({ appointmentId: z.string() }))
  .handler(async ({ input, errors }) => {
    const appointment = await prisma.appointment.findUnique({
      where: { id: input.appointmentId },
      include: {
        agenda: {
          select: {
            id: true,
            name: true,
            slug: true,
            slotDuration: true,
            organization: { select: { slug: true, name: true, logo: true } },
          },
        },
        lead: { select: { name: true, phone: true, email: true } },
      },
    });

    if (!appointment) throw errors.NOT_FOUND({ message: "Agendamento não encontrado" });

    return { appointment };
  });
