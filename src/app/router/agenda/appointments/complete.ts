import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const completeAppointment = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      appointmentId: z.string().min(1, "Appointment ID is required"),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { appointmentId } = input;

    const appointment = await prisma.appointment.findFirst({
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

    if (appointment.status === "DONE") {
      throw errors.BAD_REQUEST({
        message: "Appointment is already completed",
      });
    }

    if (appointment.status === "CANCELLED") {
      throw errors.BAD_REQUEST({
        message: "Cancelled appointments cannot be completed",
      });
    }

    const updatedAppointment = await prisma.appointment.update({
      where: {
        id: appointmentId,
      },
      data: {
        status: "DONE",
      },
    });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "spacetime",
      action: "appointment.completed",
      actionLabel: `Concluiu agendamento "${appointment.title ?? appointmentId}"`,
      resourceId: appointmentId,
      metadata: { previousStatus: appointment.status },
    });

    return { appointment: updatedAppointment };
  });
