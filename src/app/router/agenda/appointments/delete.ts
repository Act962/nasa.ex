import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { loadAppointmentSnapshot, recordAppointmentChange } from "@/features/org-defaults/lib/attendance/appointment";

const MANAGER_ROLES = new Set(["owner", "admin", "moderador"]);

export const deleteAppointment = base
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
      include: {
        agenda: {
          select: {
            responsibles: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!appointment) {
      throw errors.BAD_REQUEST({
        message: "Appointment not found",
      });
    }

    const currentMember = await prisma.member.findFirst({
      where: {
        organizationId: context.org.id,
        userId: context.user.id,
      },
      select: {
        role: true,
      },
    });

    const isAgendaOwner = appointment.agenda.responsibles.some(
      (responsible) => responsible.userId === context.user.id,
    );
    const isOrgManager = !!currentMember && MANAGER_ROLES.has(currentMember.role);
    const isAppointmentCreator = appointment.userId === context.user.id;

    if (!isAgendaOwner && !isOrgManager && !isAppointmentCreator) {
      throw new ORPCError("FORBIDDEN", {
        message: "Sem permissão para deletar este agendamento",
      });
    }

    const snapshotBeforeDelete = await loadAppointmentSnapshot(appointmentId);
    const deletedAppointment = await prisma.appointment.delete({
      where: {
        id: appointmentId,
      },
    });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "spacetime",
      action: "appointment.deleted",
      actionLabel: `Deletou agendamento "${appointment.title ?? appointmentId}"`,
      resourceId: appointmentId,
      metadata: { previousStatus: appointment.status },
    });

    await recordAppointmentChange({
      appointmentId,
      change: "deleted",
      actorId: context.user.id,
      snapshot: snapshotBeforeDelete,
    }).catch((error: unknown) => console.warn("[agenda.delete] atendimento do agendamento falhou", error));

    return { appointment: deletedAppointment };
  });
