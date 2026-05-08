import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const listJourney = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "List full journey events of a lead",
    tags: ["Leads"],
  })
  .input(
    z.object({
      leadId: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      // Cast: campos novos (eventType, previous*) só existem no client após
      // `prisma generate` rodar pós-migration.
      const events = await (prisma.leadHistory.findMany as (args: unknown) => Promise<unknown[]>)({
        where: { leadId: input.leadId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          action: true,
          eventType: true,
          notes: true,
          createdAt: true,
          previousStatusId: true,
          newStatusId: true,
          previousTrackingId: true,
          newTrackingId: true,
          previousResponsibleId: true,
          newResponsibleId: true,
          metadata: true,
          user: { select: { id: true, name: true, image: true } },
        },
      });
      return { events: events as unknown[] };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
