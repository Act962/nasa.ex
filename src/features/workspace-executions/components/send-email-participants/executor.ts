import { NodeExecutor } from "@/features/workspace-executions/types";
import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";
import { wsSendEmailChannel } from "@/inngest/channels/workspace";
import { ActionContext } from "../../schemas";
import { loadActionContext } from "../../lib/load-action-context";
import { renderWorkspaceVariables } from "../../lib/render-variables";
import { resend } from "@/lib/email/resend";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";

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

      const from = process.env.BETTER_AUTH_EMAIL ?? "noreply@nasaex.com";

      for (const participant of participants) {
        if (!participant.email) continue;

        const renderCtx = {
          action: detail,
          workspace: { name: workspace.name },
          column: column ? { name: column.name } : undefined,
          participant: {
            name: participant.name,
            email: participant.email,
          },
        };
        const renderedBody = renderWorkspaceVariables(cfg.body, renderCtx);
        const renderedSubject = renderWorkspaceVariables(cfg.subject, renderCtx);

        try {
          await prisma.userNotification.create({
            data: {
              userId: participant.id,
              title: renderedSubject,
              body: renderedBody,
              type: "CUSTOM",
              appKey: "workspace",
              actionUrl: `/workspaces/${workspace.id}?actionId=${detail.id}`,
            },
          });
        } catch (notifyErr) {
          console.error(
            `[ws-send-email-participants] Failed to create notification for ${participant.id}`,
            notifyErr,
          );
        }

        // Cobra 1★ ANTES de chamar Resend — evita custo de API sem saldo.
        // Email é cobrado por destinatário (1★/destinatário). Se saldo
        // insuficiente, pula esse destinatário e segue pros demais (loga
        // warning mas não trava o workflow inteiro).
        const charge = await chargeStarsByAction(
          workspace.organizationId,
          "workspace_email_send",
          {
            appSlug: "workspace_email_send",
            description: `Email Workspace — ${participant.email}`,
          },
        );
        if (!charge.success) {
          console.warn(
            `[ws-send-email-participants] Saldo de STARs insuficiente — pulando envio pra ${participant.email}`,
          );
          continue;
        }

        try {
          await resend.emails.send({
            from,
            to: participant.email,
            subject: renderedSubject,
            text: renderedBody,
          });
        } catch (mailErr) {
          console.error(
            `[ws-send-email-participants] Failed to send email to ${participant.email}`,
            mailErr,
          );
        }
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
