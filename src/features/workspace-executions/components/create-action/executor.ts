import { NodeExecutor } from "@/features/workspace-executions/types";
import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";
import { wsCreateActionChannel } from "@/inngest/channels/workspace";
import { Prisma } from "@/generated/prisma/client";

type Priority = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type ActionItem = {
  title: string;
  description?: string;
  priority: Priority;
  columnId: string;
  workspaceId?: string;
  participants?: string[];
  subActions?: { title: string; description?: string }[];
};

type Data = {
  action?: ActionItem;
  actions?: ActionItem[];
};

export const wsCreateActionExecutor: NodeExecutor<Data> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  const realTime = context.realTime as boolean;

  const result = await step.run("ws-create-action", async () => {
    if (realTime) {
      await publish(
        wsCreateActionChannel().status({ nodeId, status: "loading" }),
      );
    }
    try {
      const items: ActionItem[] =
        data.actions && data.actions.length > 0
          ? data.actions
          : data.action
            ? [data.action]
            : [];

      if (items.length === 0) {
        throw new NonRetriableError("Action config is missing");
      }

      const created: { id: string }[] = [];

      for (const action of items) {
        const workspaceId =
          action.workspaceId ?? (context.workspaceId as string | undefined);
        if (!workspaceId) {
          throw new NonRetriableError("Workspace context is missing");
        }

        const first = await prisma.action.findFirst({
          where: { columnId: action.columnId, workspaceId },
          orderBy: { order: "asc" },
        });
        const newOrder = first
          ? Prisma.Decimal.sub(first.order, 1)
          : new Prisma.Decimal(0);

        const workspace = await prisma.workspace.findUnique({
          where: { id: workspaceId },
        });
        if (!workspace) throw new NonRetriableError("Workspace not found");

        const createdAction = await prisma.action.create({
          data: {
            title: action.title,
            description: action.description,
            priority: action.priority,
            workspaceId,
            // organizationId é OBRIGATÓRIO pra ação aparecer no calendário —
            // `getWorkspaceCalendar` filtra por org. Pega da workspace.
            organizationId: workspace.organizationId,
            columnId: action.columnId,
            order: newOrder,
            createdBy: workspace.createdBy,
          },
        });

        const participantIds = Array.from(
          new Set((action.participants ?? []).filter(Boolean)),
        );
        if (participantIds.length > 0) {
          await prisma.actionsUserParticipant.createMany({
            data: participantIds.map((userId) => ({
              actionId: createdAction.id,
              userId,
            })),
            skipDuplicates: true,
          });
        }

        const subActions = (action.subActions ?? []).filter(
          (s) => s.title && s.title.trim().length > 0,
        );
        if (subActions.length > 0) {
          await prisma.subActions.createMany({
            data: subActions.map((s) => ({
              title: s.title,
              description: s.description,
              actionId: createdAction.id,
            })),
          });
        }

        created.push({ id: createdAction.id });
      }

      if (realTime) {
        await publish(
          wsCreateActionChannel().status({ nodeId, status: "success" }),
        );
      }

      return {
        ...context,
        action: created[0],
        actions: created,
      };
    } catch (err) {
      if (realTime) {
        await publish(
          wsCreateActionChannel().status({ nodeId, status: "error" }),
        );
      }
      throw err;
    }
  });

  return result;
};
