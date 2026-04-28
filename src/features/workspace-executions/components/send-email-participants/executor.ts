import { NodeExecutor } from "@/features/workspace-executions/types";
import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";
import { wsSendEmailChannel } from "@/inngest/channels/workspace";
import { ActionContext } from "../../schemas";
import { loadActionContext } from "../../lib/load-action-context";
import { renderWorkspaceVariables } from "../../lib/render-variables";

type Data = {
  action?: {
    subject: string;
    body: string;
  };
};

export const wsSendEmailParticipantsExecutor: NodeExecutor<Data> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  const realTime = context.realTime as boolean;

  return step.run("ws-send-email-participants", async () => {
    if (realTime) {
      await publish(
        wsSendEmailChannel().status({ nodeId, status: "loading" }),
      );
    }
    try {
      const action = context.action as ActionContext | undefined;
      const cfg = data.action;
      if (!action || !cfg?.subject || !cfg?.body) {
        throw new NonRetriableError("Action or email config missing");
      }

      const detail = await loadActionContext(action.id);
      if (!detail) {
        throw new NonRetriableError("Action not found");
      }

      const workspace = await prisma.workspace.findUnique({
        where: { id: detail.workspaceId },
      });
      if (!workspace) throw new NonRetriableError("Workspace not found");

      const column = detail.columnId
        ? await prisma.workspaceColumn.findUnique({
            where: { id: detail.columnId },
          })
        : null;

      const participants = await prisma.user.findMany({
        where: { id: { in: detail.participantIds } },
      });

      for (const participant of participants) {
        if (!participant.email) continue;

        const rendered = renderWorkspaceVariables(cfg.body, {
          action: detail,
          workspace: { name: workspace.name },
          column: column ? { name: column.name } : undefined,
          participant: {
            name: participant.name,
            email: participant.email,
          },
        });

        // Envio de email: registrar notificação no sistema, que aciona
        // os providers configurados (o projeto já possui UserNotification).
        await prisma.userNotification.create({
          data: {
            userId: participant.id,
            title: cfg.subject,
            body: rendered,
            type: "CUSTOM",
            appKey: "workspace",
            actionUrl: `/workspaces/${workspace.id}?actionId=${detail.id}`,
          },
        });
      }

      if (realTime) {
        await publish(
          wsSendEmailChannel().status({ nodeId, status: "success" }),
        );
      }
      return context;
    } catch (err) {
      if (realTime) {
        await publish(
          wsSendEmailChannel().status({ nodeId, status: "error" }),
        );
      }
      throw err;
    }
  });
};
