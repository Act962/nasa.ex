import { NodeExecutor } from "@/features/workspace-executions/types";
import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";
import { wsAddTagChannel } from "@/inngest/channels/workspace";
import { publishActionChanged } from "@/features/actions/realtime/publish";
import { ActionContext } from "../../schemas";

type Data = {
  action?: { tagId: string };
};

export const wsAddTagActionExecutor: NodeExecutor<Data> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  const realTime = context.realTime as boolean;

  return step.run("ws-add-tag-action", async () => {
    if (realTime) {
      await publish(wsAddTagChannel().status({ nodeId, status: "loading" }));
    }
    try {
      const action = context.action as ActionContext | undefined;
      const tagId = data.action?.tagId;
      if (!action || !tagId) {
        throw new NonRetriableError("Action or tag missing");
      }

      const dbAction = await prisma.action.findUnique({
        where: { id: action.id },
        select: { columnId: true, workspaceId: true },
      });

      await prisma.actionTag.upsert({
        where: { actionId_tagId: { actionId: action.id, tagId } },
        create: { actionId: action.id, tagId },
        update: {},
      });

      if (dbAction?.columnId && dbAction?.workspaceId) {
        await publishActionChanged(publish, {
          actionId: action.id,
          columnId: dbAction.columnId,
          workspaceId: dbAction.workspaceId,
          fields: ["tag"],
        });
      }

      if (realTime) {
        await publish(wsAddTagChannel().status({ nodeId, status: "success" }));
      }
      return { ...context, action: { id: action.id } };
    } catch (err) {
      if (realTime) {
        await publish(wsAddTagChannel().status({ nodeId, status: "error" }));
      }
      throw err;
    }
  });
};
