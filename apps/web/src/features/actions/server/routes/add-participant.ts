import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { sendWorkspaceWorkflowEvent } from "@/inngest/utils";
import { z } from "zod";

export const addParticipant = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      userId: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const participant = await prisma.actionsUserParticipant.upsert({
      where: {
        actionId_userId: {
          actionId: input.actionId,
          userId: input.userId,
        },
      },
      create: {
        actionId: input.actionId,
        userId: input.userId,
      },
      update: {},
      include: {
        user: {
          select: { id: true, name: true, image: true, email: true },
        },
        action: {
          select: {
            id: true,
            workspaceId: true,
          },
        },
      },
    });

    try {
      await sendWorkspaceWorkflowEvent({
        trigger: "WS_ACTION_PARTICIPANT_ADDED",
        workspaceId: participant.action.workspaceId,
        actionId: participant.action.id,
      });
    } catch (err) {
      console.error(
        "[workspace-workflow] failed to emit action.participant.added",
        err,
      );
    }

    return { participant };
  });
