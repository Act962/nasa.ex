import { NodeExecutor } from "@/features/workspace-executions/types";
import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";
import { logOrgActivity } from "@/lib/org-activity-log";
import { wsMoveActionChannel } from "@/inngest/channels/workspace";
import { ActionContext } from "../../schemas";

type Data = {
  action?: {
    columnId: string;
    workspaceId?: string;
  };
};

export const wsMoveActionExecutor: NodeExecutor<Data> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  const realTime = context.realTime as boolean;

  return step.run("ws-move-action", async () => {
    if (realTime) {
      await publish(
        wsMoveActionChannel().status({ nodeId, status: "loading" }),
      );
    }
    try {
      const action = context.action as ActionContext | undefined;
      const cfg = data.action;
      if (!action || !cfg) {
        throw new NonRetriableError("Action or config missing");
      }

      const dbAction = await prisma.action.findUnique({
        where: { id: action.id },
        select: {
          id: true,
          organizationId: true,
          createdBy: true,
          workspaceId: true,
        },
      });
      if (!dbAction) {
        throw new NonRetriableError("Action not found");
      }
      const workspaceId = cfg.workspaceId ?? dbAction.workspaceId;

      await prisma.action.update({
        where: { id: action.id },
        data: {
          columnId: cfg.columnId,
          workspaceId,
        },
      });

      if (dbAction?.organizationId) {
        await logOrgActivity({
          organizationId: dbAction.organizationId,
          userId: dbAction.createdBy,
          userName: "Workflow",
          userEmail: "workflow@nasa.ex",
          action: "action.moved",
          resource: "action",
          resourceId: dbAction.id,
          metadata: {
            source: "workflow",
            from: { workspaceId: dbAction.workspaceId },
            to: { columnId: cfg.columnId, workspaceId },
          },
        });
      }

      if (realTime) {
        await publish(
          wsMoveActionChannel().status({ nodeId, status: "success" }),
        );
      }
      return { ...context, action: { id: action.id } };
    } catch (err) {
      if (realTime) {
        await publish(
          wsMoveActionChannel().status({ nodeId, status: "error" }),
        );
      }
      throw err;
    }
  });
};
