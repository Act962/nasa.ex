import { NodeExecutor } from "@/features/executions/types";
import { LeadContext } from "../../schemas";
import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";

type MoveLeadNodeData = {
  trackingId?: string;
  statusId?: string;
};

export const moveLeadExecutor: NodeExecutor<MoveLeadNodeData> = async ({
  data,
  nodeId,
  context,
  step,
}) => {
  const result = await step.run("move-lead", async () => {
    const lead = context.lead as LeadContext;

    if (!lead) {
      throw new NonRetriableError("Lead not found");
    }

    const tracking = await prisma.tracking.findUnique({
      where: {
        id: data.trackingId,
      },
    });

    if (!tracking) {
      throw new NonRetriableError("Tracking not found");
    }

    const status = await prisma.status.findUnique({
      where: {
        id: data.statusId,
      },
    });

    if (!status) {
      throw new NonRetriableError("Status not found");
    }

    const updatedLead = await prisma.lead.update({
      where: {
        id: lead.id,
      },
      data: {
        trackingId: data.trackingId,
        statusId: data.statusId,
      },
    });

    return {
      ...context,
      lead: updatedLead,
    };
  });

  return result;
};
