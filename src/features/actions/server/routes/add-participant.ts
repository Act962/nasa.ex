import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { sendWorkspaceWorkflowEvent } from "@/inngest/utils";
import { z } from "zod";
import { findActionInOrg, isOrgMember } from "../lib/action-access";
import { notifyNewTask } from "../lib/notify-new-task";

export const addParticipant = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      userId: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const action = await findActionInOrg(input.actionId, context.org.id);
    if (!action) throw errors.NOT_FOUND({ message: "Ação não encontrada" });

    if (!(await isOrgMember(input.userId, context.org.id))) {
      throw errors.FORBIDDEN({
        message: "Usuário não pertence a esta organização",
      });
    }

    const wasAlreadyInTask = await prisma.actionsUserParticipant.findUnique({
      where: { actionId_userId: { actionId: input.actionId, userId: input.userId } },
      select: { userId: true },
    });

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
            title: true,
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

    if (!wasAlreadyInTask) {
      await notifyNewTask({
        actionId: participant.action.id,
        title: participant.action.title,
        workspaceId: participant.action.workspaceId,
        organizationId: context.org.id,
        actorId: context.user.id,
        actorName: context.user.name,
        userIds: [input.userId],
      });
    }

    return { participant };
  });
