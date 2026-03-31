import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import z from "zod";

export const updateAgenda = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "PUT",
    summary: "Update agenda",
    tags: ["Agenda"],
  })
  .input(
    z.object({
      agendaId: z.string(),
      name: z.string().optional(),
      description: z.string().optional().nullable(),
      slug: z.string().optional(),
      slotDuration: z.coerce.number().optional(),
      trackingId: z.string().optional(),
      isActive: z.boolean().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const agenda = await prisma.agenda.findUnique({
      where: {
        id: input.agendaId,
        organizationId: context.org.id,
      },
    });

    if (!agenda) {
      throw errors.NOT_FOUND({
        message: "Agenda não encontrada",
      });
    }

    if (input.slug && input.slug !== agenda.slug) {
      const slugExists = await prisma.agenda.findFirst({
        where: {
          slug: input.slug,
          organizationId: context.org.id,
          id: {
            not: agenda.id,
          },
        },
      });

      if (slugExists) {
        throw errors.BAD_REQUEST({
          message: "Este link já está em uso, por favor escolha outro.",
        });
      }
    }

    if (input.trackingId) {
      const tracking = await prisma.tracking.findUnique({
        where: {
          id: input.trackingId,
          organizationId: context.org.id,
        },
      });

      if (!tracking) {
        throw errors.NOT_FOUND({
          message: "Tracking não encontrado no sistema.",
        });
      }
    }

    const updatedAgenda = await prisma.agenda.update({
      where: {
        id: input.agendaId,
      },
      data: {
        name: input.name,
        description: input.description,
        slug: input.slug,
        slotDuration: input.slotDuration,
        trackingId: input.trackingId,
        isActive: input.isActive,
      },
    });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "spacetime",
      action: "agenda.updated",
      actionLabel: `Atualizou a agenda "${updatedAgenda.name}"`,
      resource: updatedAgenda.name,
      resourceId: updatedAgenda.id,
    });

    return { agenda: updatedAgenda };
  });

