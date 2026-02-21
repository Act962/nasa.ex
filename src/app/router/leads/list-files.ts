import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const listLeadFiles = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/leads/:leadId/files",
    summary: "List lead files",
    tags: ["Leads"],
  })
  .input(
    z.object({
      leadId: z.string(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const lead = await prisma.lead.findUnique({
        where: {
          id: input.leadId,
        },
        select: {
          id: true,
        },
      });

      if (!lead) {
        throw errors.NOT_FOUND;
      }

      const leadFiles = await prisma.leadFile.findMany({
        where: {
          leadId: lead.id,
        },
        select: {
          id: true,
          name: true,
          fileUrl: true,
          mimeType: true,
          createdAt: true,
          createdBy: true,
        },
      });

      return { leadFiles };
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
