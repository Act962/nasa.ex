import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

// 🟦 UPDATE
export const archiveLead = base
  .route({
    method: "POST",
    path: "/archive/{leadId}",
    summary: "Archive lead",
    tags: ["Leads"],
  })
  .use(requiredAuthMiddleware)
  .input(z.object({ leadId: z.string() }))
  .output(
    z.object({
      lead: z.object({
        id: z.string(),
        name: z.string(),
        trackingId: z.string(),
      }),
    })
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const { id: userId } = context.user;

      const leadExists = await prisma.lead.findUnique({
        where: { id: input.leadId },
      });

      if (!leadExists) {
        throw errors.NOT_FOUND;
      }

      await prisma.$transaction([
        prisma.leadHistory.create({
          data: {
            leadId: input.leadId,
            notes: "Lead arquivado",
            userId,
            action: "DELETED",
          },
        }),

        prisma.lead.update({
          where: { id: input.leadId },
          data: {
            currentAction: "DELETED",
          },
        }),
      ]);

      return {
        lead: leadExists,
      };
    } catch (error) {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
