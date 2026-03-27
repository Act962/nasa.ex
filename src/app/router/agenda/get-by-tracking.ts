import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const getAgendasByTracking = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "Get agendas linked to a tracking",
    tags: ["Agenda"],
  })
  .input(z.object({ trackingId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const agendas = await prisma.agenda.findMany({
      where: {
        trackingId: input.trackingId,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        slotDuration: true,
        organization: {
          select: { slug: true },
        },
        availabilities: {
          where: { isActive: true },
          select: { dayOfWeek: true, isActive: true },
        },
        dateOverrides: {
          where: { isBlocked: true },
          select: { date: true, isBlocked: true },
        },
      },
    });

    return { agendas };
  });
