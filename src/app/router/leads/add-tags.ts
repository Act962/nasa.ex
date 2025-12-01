import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const addTagsToLead = base
  .use(requiredAuthMiddleware)
  .route({
    path: "/leads/add-tags",
    method: "POST",
  })
  .input(
    z.object({
      leadId: z.string(),
      tagIds: z.array(z.string()).min(1),
    })
  )
  .handler(async ({ input, context, errors }) => {
    const { org } = context;

    if (!org) {
      throw errors.BAD_REQUEST;
    }

    const lead = await prisma.lead.findUnique({
      where: { id: input.leadId },
    });

    if (!lead) {
      throw errors.UNAUTHORIZED;
    }

    const result = await prisma.leadTag.createMany({
      data: input.tagIds.map((tagId) => ({
        leadId: input.leadId,
        tagId,
      })),
      skipDuplicates: true,
    });

    return {
      count: result.count,
    };
  });
