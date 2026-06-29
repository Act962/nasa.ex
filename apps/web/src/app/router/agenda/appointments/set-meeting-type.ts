import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

export const meetingTypeSchema = z.enum(["ONLINE", "IN_PERSON"]);

export const setAppointmentMeetingType = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      appointmentId: z.string().min(1),
      meetingType: meetingTypeSchema,
    }),
  )
  .handler(async ({ context, input, errors }) => {
    // Garante que o agendamento pertence à organização do usuário.
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

    await prisma.appointment.update({
      where: { id: input.appointmentId },
      data: { meetingType: input.meetingType },
    });

    return {
      appointment: {
        id: existing.id,
        trackingId: existing.trackingId,
        meetingType: input.meetingType,
      },
    };
  });
