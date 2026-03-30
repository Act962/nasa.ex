import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const getAgendasByTracking = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Get agendas linked to a tracking (or all org agendas if no trackingId)",
    tags: ["Agenda"],
  })
  .input(z.object({ trackingId: z.string().optional() }))
  .handler(async ({ input, context }) => {
    const agendas = await prisma.agenda.findMany({
      where: input.trackingId
        ? { trackingId: input.trackingId, isActive: true }
        : { organizationId: context.org.id, isActive: true },
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
