import { NodeExecutor } from "@/features/executions/types";
import { NonRetriableError } from "inngest";
import { WinLossFormValues } from "./dialog";
import { LeadContext } from "../../schemas";
import prisma from "@/lib/prisma";
import { winLossChannel } from "@/inngest/channels/win-loss";

type WinLossNodeData = {
  action?: WinLossFormValues;
};

export const winLossExecutor: NodeExecutor<WinLossNodeData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  const realTime = context.realTime as boolean;

  await step.run("win_loss", async () => {
    try {
      const lead = context.lead as LeadContext;
      if (realTime) {
        await publish(
          winLossChannel().status({
            nodeId,
            status: "loading",
          }),
        );
      }

      if (!lead) {
        if (realTime) {
          await publish(
            winLossChannel().status({
              nodeId,
              status: "error",
            }),
          );
        }
        throw new NonRetriableError("Lead not found");
      }

      const reasonExists = await prisma.winLossReason.findUnique({
        where: {
          id: data.action?.reason,
        },
      });

      if (!reasonExists) {
        if (realTime) {
          await publish(
            winLossChannel().status({
              nodeId,
              status: "error",
            }),
          );
        }

        throw new NonRetriableError("Reason not found");
      }

      const leadAction = reasonExists.type === "WIN" ? "WON" : "LOST";

      // Adicionar histórico

      const leadUpdated = await prisma.lead.update({
        where: { id: lead.id },
        data: {
          currentAction: leadAction,
          closedAt: new Date(),
        },
      });

      return {
        ...context,
        lead: leadUpdated,
      };
    } catch (error) {
      if (realTime) {
        await publish(
          winLossChannel().status({
            nodeId,
            status: "error",
          }),
        );
      }

      throw error;
    }
  });

  if (realTime) {
    await publish(
      winLossChannel().status({
        nodeId,
        status: "success",
      }),
    );
  }

  return context;
};
