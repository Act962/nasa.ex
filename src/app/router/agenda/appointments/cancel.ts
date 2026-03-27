import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const cancelAppointment = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      appointmentId: z.string().min(1, "Appointment ID is required"),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { appointmentId } = input;

    const appointment = await prisma.appointment.findUnique({
      where: {
        id: appointmentId,
        agenda: {
          organizationId: context.org.id,
        },
      },
    });

    if (!appointment) {
      throw errors.BAD_REQUEST({
        message: "Appointment not found",
      });
    }

    if (appointment.status === "CANCELLED") {
      throw errors.BAD_REQUEST({
        message: "Appointment is already cancelled",
      });
    }

    const updatedAppointment = await prisma.appointment.update({
      where: {
        id: appointmentId,
      },
      data: {
        status: "CANCELLED",
      },
    });

    return { appointment: updatedAppointment };
  });
