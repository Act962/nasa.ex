import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
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
    }),
  )
  .handler(async ({ input, context }) => {
    const agenda = await prisma.agenda.create({
      data: {
        name: input.name,
        description: input.description,
        slotDuration: input.duration,
        trackingId: input.trackingId,
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

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "spacetime",
      action: "agenda.created",
      actionLabel: `Criou a agenda "${agenda.name}"`,
      resource: agenda.name,
      resourceId: agenda.id,
    });

    return { agenda };
  });
