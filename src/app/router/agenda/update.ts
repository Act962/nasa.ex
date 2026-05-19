import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
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
      statusId: z.string().nullable().optional(),
      tagIds: z.array(z.string()).optional(),
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

    const trackingChanged =
      input.trackingId !== undefined && input.trackingId !== agenda.trackingId;
    const effectiveTrackingId = input.trackingId ?? agenda.trackingId;

    // Status precisa pertencer ao tracking efetivo (o novo, se houve troca).
    if (input.statusId) {
      const status = await prisma.status.findUnique({
        where: { id: input.statusId },
      });
      if (!status || status.trackingId !== effectiveTrackingId) {
        throw errors.BAD_REQUEST({
          message: "Status não pertence ao tracking selecionado.",
        });
      }
    }

    // Tags precisam ser da organização.
    if (input.tagIds && input.tagIds.length > 0) {
      const tags = await prisma.tag.findMany({
        where: {
          id: { in: input.tagIds },
          organizationId: context.org.id,
        },
        select: { id: true },
      });
      if (tags.length !== input.tagIds.length) {
        throw errors.BAD_REQUEST({
          message: "Uma ou mais tags não pertencem à organização.",
        });
      }
    }

    const updatedAgenda = await prisma.$transaction(async (tx) => {
      const updated = await tx.agenda.update({
        where: { id: input.agendaId },
        data: {
          name: input.name,
          description: input.description,
          slug: input.slug,
          slotDuration: input.slotDuration,
          trackingId: input.trackingId,
          isActive: input.isActive,
          // Se trackingId mudou, força reset do status (mesmo se o cliente
          // não enviou statusId). Caso contrário, só aplica se foi enviado.
          ...(trackingChanged
            ? { statusId: input.statusId ?? null }
            : input.statusId !== undefined
              ? { statusId: input.statusId }
              : {}),
        },
      });

      // Se o tracking mudou, desvincula todas as tags da agenda antiga antes
      // de aplicar a nova lista. Tags do tracking antigo não fazem sentido.
      if (trackingChanged) {
        await tx.tag.updateMany({
          where: { agendaId: input.agendaId },
          data: { agendaId: null },
        });
      }

      if (input.tagIds !== undefined) {
        // Desvincula tags que estavam ligadas a esta agenda mas não estão
        // mais na lista (essa updateMany é segura mesmo se já zerou acima).
        await tx.tag.updateMany({
          where: {
            agendaId: input.agendaId,
            id: { notIn: input.tagIds },
          },
          data: { agendaId: null },
        });

        if (input.tagIds.length > 0) {
          await tx.tag.updateMany({
            where: {
              id: { in: input.tagIds },
              organizationId: context.org.id,
            },
            data: { agendaId: input.agendaId },
          });
        }
      }

      return updated;
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

