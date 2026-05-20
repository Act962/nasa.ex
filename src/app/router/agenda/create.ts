import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { slugify } from "@/lib/utils";
import z from "zod";

const DEFAULT_TIME_SLOTS = [
  { startTime: "08:00", endTime: "12:00", order: 0 },
  { startTime: "14:00", endTime: "18:00", order: 1 },
];

const WEEK_DAYS = [
  { dayOfWeek: "SUNDAY", isActive: false },
  { dayOfWeek: "MONDAY", isActive: true },
  { dayOfWeek: "TUESDAY", isActive: true },
  { dayOfWeek: "WEDNESDAY", isActive: true },
  { dayOfWeek: "THURSDAY", isActive: true },
  { dayOfWeek: "FRIDAY", isActive: true },
  { dayOfWeek: "SATURDAY", isActive: false },
] as const;

export const createAgenda = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Create a new agenda",
    tags: ["Agenda"],
  })
  .input(
    z.object({
      name: z.string(),
      slug: z.string().optional(),
      description: z.string().optional(),
      duration: z.number().optional(),
      trackingId: z.string(),
      statusId: z.string().nullable().optional(),
      tagIds: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    // Status precisa pertencer ao tracking informado.
    if (input.statusId) {
      const status = await prisma.status.findUnique({
        where: { id: input.statusId },
      });
      if (!status || status.trackingId !== input.trackingId) {
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

    const agenda = await prisma.$transaction(async (tx) => {
      const created = await tx.agenda.create({
        data: {
          name: input.name,
          description: input.description,
          slotDuration: input.duration,
          trackingId: input.trackingId,
          statusId: input.statusId ?? null,
          organizationId: context.org.id,
          slug: input.slug || slugify(input.name),
          responsibles: {
            create: {
              userId: context.user.id,
            },
          },

          availabilities: {
            create: WEEK_DAYS.map((day) => ({
              dayOfWeek: day.dayOfWeek,
              isActive: day.isActive,
              timeSlots: {
                create: DEFAULT_TIME_SLOTS,
              },
            })),
          },
        },
      });

      if (input.tagIds && input.tagIds.length > 0) {
        await tx.tag.updateMany({
          where: {
            id: { in: input.tagIds },
            organizationId: context.org.id,
          },
          data: { agendaId: created.id },
        });
      }

      return created;
    });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "spacetime",
      action: "agenda_create",
      actionLabel: `Criou a agenda "${agenda.name}"`,
      resource: agenda.name,
      resourceId: agenda.id,
    });

    // Cobra Stars conforme regra global `agenda_create`. Best-effort —
    // se cobrança falhar (saldo zero, regra inativa), agenda já foi
    // criada e nao revertemos.
    await chargeStarsByAction(context.org.id, "agenda_create", {
      userId: context.user.id,
      description: `Criou agenda "${agenda.name}"`,
      appSlug: "spacetime",
    });

    return { agenda };
  });
