import { NodeExecutor } from "@/features/workspace-executions/types";
import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";
import { wsAddParticipantChannel } from "@/inngest/channels/workspace";
import { ActionContext } from "../../schemas";

type Data = {
  action?: {
    userIds?: string[];
    userId?: string;
  };
};

export const wsAddParticipantExecutor: NodeExecutor<Data> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  const realTime = context.realTime as boolean;

  return step.run("ws-add-participant", async () => {
    if (realTime) {
      await publish(
        wsAddParticipantChannel().status({ nodeId, status: "loading" }),
      );
    }
    try {
      const action = context.action as ActionContext | undefined;
      const rawUserIds = data.action?.userIds;
      const legacyUserId = data.action?.userId;
      const userIds = Array.from(
        new Set(
          (rawUserIds && rawUserIds.length > 0
            ? rawUserIds
            : legacyUserId
              ? [legacyUserId]
              : []
          ).filter(Boolean),
        ),
      );

      if (!action || userIds.length === 0) {
        throw new NonRetriableError("Action or users missing");
      }

      await prisma.$transaction(
        userIds.map((userId) =>
          prisma.actionsUserParticipant.upsert({
            where: { actionId_userId: { actionId: action.id, userId } },
            create: { actionId: action.id, userId },
            update: {},
          }),
        ),
      );

      if (realTime) {
        await publish(
          wsAddParticipantChannel().status({ nodeId, status: "success" }),
        );
      }
      return { ...context, action: { id: action.id } };
    } catch (err) {
      if (realTime) {
        await publish(
          wsAddParticipantChannel().status({ nodeId, status: "error" }),
        );
      }
      throw err;
    }
  });
};
