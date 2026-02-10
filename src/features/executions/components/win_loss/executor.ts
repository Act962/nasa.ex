import { NodeExecutor } from "@/features/executions/types";
import { NonRetriableError } from "inngest";
import { WinLossFormValues } from "./dialog";
import { LeadContext } from "../../schemas";
import prisma from "@/lib/prisma";

type WinLossNodeData = {
  action?: WinLossFormValues;
};

export const winLossExecutor: NodeExecutor<WinLossNodeData> = async ({
  data,
  nodeId,
  context,
  step,
}) => {
  await step.run("win_loss", async () => {
    const lead = context.lead as LeadContext;

    if (!lead) {
      throw new NonRetriableError("Lead not found");
    }

    const reasonExists = await prisma.winLossReason.findUnique({
      where: {
        id: data.action?.reason,
      },
    });

    if (!reasonExists) {
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
  });

  return context;
};
