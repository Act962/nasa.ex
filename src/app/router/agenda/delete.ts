import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import z from "zod";

export const deleteAgenda = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "DELETE",
    summary: "Delete an agenda",
    tags: ["Agenda"],
  })
  .input(
    z.object({
      agendaId: z.string(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    const agenda = await prisma.agenda.findUnique({
      where: {
        id: input.agendaId,
      },
      include: {
        availabilities: {
          include: {
            timeSlots: true,
          },
        },
      },
    });

    if (!agenda) {
      throw errors.NOT_FOUND({
        message: "Agenda não encontrada",
      });
    }

    await prisma.agenda.delete({
      where: {
        id: input.agendaId,
      },
    });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "spacetime",
      action: "agenda.deleted",
      actionLabel: `Excluiu a agenda "${agenda.name}"`,
      resource: agenda.name,
      resourceId: agenda.id,
    });

    return { agenda };
  });
