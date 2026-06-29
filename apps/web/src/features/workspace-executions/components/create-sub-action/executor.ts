import { NodeExecutor } from "@/features/workspace-executions/types";
import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";
import { wsCreateSubActionChannel } from "@/inngest/channels/workspace";
import { publishSubActionCreated } from "@/features/actions/realtime/publish";
import { ActionContext } from "../../schemas";

type SubActionItem = {
  title: string;
  description?: string;
  responsibleId?: string;
};

type Data = {
  action?: { title: string; description?: string };
  subActions?: SubActionItem[];
};

export const wsCreateSubActionExecutor: NodeExecutor<Data> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  const realTime = context.realTime as boolean;

  return step.run("ws-create-sub-action", async () => {
    if (realTime) {
      await publish(
        wsCreateSubActionChannel().status({ nodeId, status: "loading" }),
      );
    }
    try {
      const action = context.action as ActionContext | undefined;
      if (!action) {
        throw new NonRetriableError("Action context missing");
      }

      const dbAction = await prisma.action.findUnique({
        where: { id: action.id },
        select: { columnId: true, workspaceId: true },
      });

      const items: SubActionItem[] =
        data.subActions && data.subActions.length > 0
          ? data.subActions
          : data.action?.title
            ? [{ title: data.action.title, description: data.action.description }]
            : [];

      const valid = items.filter(
        (s) => s.title && s.title.trim().length > 0,
      );
      if (valid.length === 0) {
        throw new NonRetriableError("Sub-action title missing");
      }

      for (const item of valid) {
        const created = await prisma.subActions.create({
          data: {
            title: item.title,
            description: item.description,
            actionId: action.id,
          },
        });
        if (item.responsibleId) {
          await prisma.subActionUserResponsible.create({
            data: {
              subActionId: created.id,
              userId: item.responsibleId,
            },
          });
        }
      }

      if (dbAction?.columnId && dbAction?.workspaceId) {
        await publishSubActionCreated(publish, {
          actionId: action.id,
          columnId: dbAction.columnId,
          workspaceId: dbAction.workspaceId,
          count: valid.length,
        });
      }

      if (realTime) {
        await publish(
          wsCreateSubActionChannel().status({ nodeId, status: "success" }),
        );
      }
      return context;
    } catch (err) {
      if (realTime) {
        await publish(
          wsCreateSubActionChannel().status({ nodeId, status: "error" }),
        );
      }
      throw err;
    }
  });
};
