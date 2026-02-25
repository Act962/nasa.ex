import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { LeadAction } from "@/generated/prisma/enums";
import { recordLeadHistory } from "./utils/history";

// 🟦 UPDATE
export const updateManyStatusLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PUT",
    summary: "Update many leads status",
    tags: ["Leads"],
  })
  .input(
    z
      .object({
        leadsIds: z.array(z.string()),
        statusId: z.string().optional(),
        trackingId: z.string().optional(),
      })
      .refine(
        (v) =>
          v.statusId !== undefined ||
          v.trackingId !== undefined || {
            message: "No fields to update",
            path: ["id"],
          },
      ),
  )

  .handler(async ({ input, errors, context }) => {
    try {
      const leadExists = await prisma.lead.findMany({
        where: { id: { in: input.leadsIds } },
      });

      if (leadExists.length === 0) {
        throw errors.NOT_FOUND;
      }

      const result = await prisma.$transaction(async (tx) => {
        const lead = await tx.lead.updateMany({
          where: { id: { in: input.leadsIds } },
          data: {
            statusId: input.statusId,
            trackingId: input.trackingId,
          },
        });

        // Loop to create history entries for each lead
        await Promise.all(
          input.leadsIds.map((leadId) =>
            recordLeadHistory({
              leadId,
              userId: context.user.id,
              action: LeadAction.ACTIVE,
              notes: "Status do lead atualizado em lote",
              tx,
            }),
          ),
        );

        return { lead };
      });

      return result;
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
