import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { LeadAction } from "@/generated/prisma/enums";
import { recordLeadHistory } from "./utils/history";

// 🟦 UPDATE
export const updateLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PUT",
    summary: "Update an existing lead",
    tags: ["Leads"],
  })
  .input(
    z
      .object({
        id: z.string(),
        name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        description: z.string().optional(),
        statusId: z.string().optional(),
        responsibleId: z.string().optional(),
        tagIds: z.array(z.string()).optional(),
        isConversation: z.boolean().optional().default(false),
      })
      .refine(
        (v) =>
          v.name !== undefined ||
          v.phone !== undefined ||
          v.email !== undefined ||
          v.description !== undefined ||
          v.statusId !== undefined ||
          v.responsibleId !== undefined ||
          v.tagIds !== undefined,
        {
          message: "No fields to update",
          path: ["id"],
        },
      ),
  )
  .output(
    z.object({
      lead: z.object({
        id: z.string(),
        name: z.string(),
        phone: z.string().nullable(),
        email: z.string().nullable(),
        description: z.string().nullable(),
        statusId: z.string(),
        trackingId: z.string(),
        createdAt: z.date(),
        updatedAt: z.date(),
      }),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const leadExists = await prisma.lead.findUnique({
        where: { id: input.id },
      });

      if (!leadExists) {
        throw errors.NOT_FOUND;
      }

      const result = await prisma.$transaction(async (tx) => {
        const lead = await tx.lead.update({
          where: { id: input.id },
          data: {
            name: input.name,
            phone: input.phone,
            email: input.email,
            description: input.description,
            statusId: input.statusId,
            responsibleId: input.responsibleId,
            leadTags: input.tagIds
              ? {
                  deleteMany: {},
                  create: input.tagIds.map((tagId) => ({
                    tagId,
                  })),
                }
              : undefined,
          },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            description: true,
            statusId: true,
            trackingId: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        await recordLeadHistory({
          leadId: lead.id,
          userId: context.user.id,
          action: LeadAction.ACTIVE,
          notes: "Lead atualizado",
          tx,
        });

        return { lead };
      });

      return result;
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
