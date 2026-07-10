import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

export const renameAppointment = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Rename an appointment title",
    tags: ["Agenda"],
  })
  .input(
    z.object({
      appointmentId: z.string().min(1),
      title: z.string().min(1, "Título é obrigatório"),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    const existing = await prisma.appointment.findFirst({
      where: {
        id: input.appointmentId,
        agenda: { organizationId: context.org.id },
      },
      select: { id: true, trackingId: true },
    });

    if (!existing) {
      throw errors.NOT_FOUND({ message: "Agendamento não encontrado" });
    }

    const title = input.title.trim();

    await prisma.appointment.update({
      where: { id: input.appointmentId },
      data: { title },
    });

    return {
      appointment: {
        id: existing.id,
        trackingId: existing.trackingId,
        title,
      },
    };
  });
