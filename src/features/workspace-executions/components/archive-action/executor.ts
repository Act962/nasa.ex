import { NodeExecutor } from "@/features/workspace-executions/types";
import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";
import { wsArchiveActionChannel } from "@/inngest/channels/workspace";
import { publishActionArchived } from "@/features/actions/realtime/publish";
import { ActionContext } from "../../schemas";

export const wsArchiveActionExecutor: NodeExecutor = async ({
  nodeId,
  context,
  step,
  publish,
}) => {
  const realTime = context.realTime as boolean;

  return step.run("ws-archive-action", async () => {
    if (realTime) {
      await publish(
        wsArchiveActionChannel().status({ nodeId, status: "loading" }),
      );
    }
    try {
      const action = context.action as ActionContext | undefined;
      if (!action) throw new NonRetriableError("Action missing");

      const dbAction = await prisma.action.findUnique({
        where: { id: action.id },
        select: { columnId: true, workspaceId: true },
      });

      await prisma.action.update({
        where: { id: action.id },
        data: { isArchived: true },
      });

      if (dbAction?.columnId && dbAction?.workspaceId) {
        await publishActionArchived(publish, {
          actionId: action.id,
          columnId: dbAction.columnId,
          workspaceId: dbAction.workspaceId,
        });
      }

      if (realTime) {
        await publish(
          wsArchiveActionChannel().status({ nodeId, status: "success" }),
        );
      }
      return context;
    } catch (err) {
      if (realTime) {
        await publish(
          wsArchiveActionChannel().status({ nodeId, status: "error" }),
        );
      }
      throw err;
    }
  });
};
