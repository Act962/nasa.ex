import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireOrgMiddleware } from "../../middlewares/org";
import { LeadAction } from "@/generated/prisma/enums";
import { recordLeadHistory } from "./utils/history";

export const addTagsToLead = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    path: "/leads/add-tags",
    method: "POST",
  })
  .input(
    z.object({
      leadId: z.string(),
      tagIds: z.array(z.string()).min(1),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    const lead = await prisma.lead.findUnique({
      where: { id: input.leadId },
    });

    if (!lead) {
      throw errors.UNAUTHORIZED;
    }

    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.leadTag.createMany({
        data: input.tagIds.map((tagId) => ({
          leadId: input.leadId,
          tagId,
        })),
        skipDuplicates: true,
      });

      await recordLeadHistory({
        leadId: input.leadId,
        userId: context.user.id,
        action: LeadAction.ACTIVE,
        notes: "Tags adicionadas ao lead",
        tx,
      });

      return created;
    });

    return {
      count: result.count,
    };
  });
