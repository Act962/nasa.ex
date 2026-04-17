import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { awardPoints } from "../space-point/utils";
import { pusherServer } from "@/lib/pusher";

// 🟦 UPDATE
export const updateLeadAction = base
  .route({
    method: "POST",
    path: "/update-action/{leadId}",
    summary: "Update lead action",
    tags: ["Leads"],
  })
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      leadId: z.string(),
      action: z.enum(["LOSS", "WIN"]),
      reasonId: z.string(),
      observation: z.string().optional(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const { id: userId } = context.user;

      const leadExists = await prisma.lead.findUnique({
        where: { id: input.leadId },
        select: {
          id: true,
          statusId: true,
          trackingId: true,
          tracking: {
            select: {
              organizationId: true,
            },
          },
        },
      });

      if (!leadExists) {
        throw errors.NOT_FOUND;
      }

      const reasonExists = await prisma.winLossReason.findUnique({
        where: { id: input.reasonId },
      });

      if (!reasonExists) {
        throw errors.NOT_FOUND;
      }

      const leadAction = reasonExists.type === "WIN" ? "WON" : "LOST";

      await prisma.$transaction([
        prisma.leadHistory.create({
          data: {
            leadId: input.leadId,
            reasonId: input.reasonId,
            notes: input.observation,
            userId,
            action: leadAction,
          },
        }),

        prisma.lead.update({
          where: { id: input.leadId },
          data: {
            currentAction: leadAction,
            closedAt: new Date(),
          },
        }),
      ]);

      // Gamificação em tempo real
      const spAction =
        leadAction === "WON" ? "lead_won" : "penalty_lead_lost_nofollowup";

      try {
        await awardPoints(
          userId,
          leadExists.tracking.organizationId,
          spAction,
          leadAction === "WON"
            ? "Lead marcado como ganho 🎉"
            : "Lead marcado como perdido ❌",
        );
      } catch (spErr) {
        console.error("[leads/update-action] SpacePoint award error:", spErr);
      }

      return {
        lead: leadExists,
      };
    } catch (error) {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
