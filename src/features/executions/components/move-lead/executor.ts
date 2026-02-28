import { NodeExecutor } from "@/features/executions/types";
import { LeadContext } from "../../schemas";
import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";
import { moveLeadChannel } from "@/inngest/channels/move-lead";

type MoveLeadNodeData = {
  trackingId?: string;
  statusId?: string;
};

export const moveLeadExecutor: NodeExecutor<MoveLeadNodeData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  const result = await step.run("move-lead", async () => {
    const lead = context.lead as LeadContext;
    const realTime = context.realTime as boolean;
    try {
      if (realTime) {
        await publish(
          moveLeadChannel().status({
            nodeId,
            status: "loading",
          }),
        );
      }

      if (!lead) {
        if (realTime) {
          await publish(
            moveLeadChannel().status({
              nodeId,
              status: "error",
            }),
          );
        }
        throw new NonRetriableError("Lead not found");
      }

      const tracking = await prisma.tracking.findUnique({
        where: {
          id: data.trackingId,
        },
      });

      if (!tracking) {
        if (realTime) {
          await publish(
            moveLeadChannel().status({
              nodeId,
              status: "error",
            }),
          );
        }
        throw new NonRetriableError("Tracking not found");
      }

      const status = await prisma.status.findUnique({
        where: {
          id: data.statusId,
        },
      });

      if (!status) {
        if (realTime) {
          await publish(
            moveLeadChannel().status({
              nodeId,
              status: "error",
            }),
          );
        }
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

      if (realTime) {
        await publish(
          moveLeadChannel().status({
            nodeId,
            status: "success",
          }),
        );
      }

      return {
        ...context,
        lead: updatedLead,
      };
    } catch (error) {
      if (realTime) {
        await publish(
          moveLeadChannel().status({
            nodeId,
            status: "error",
          }),
        );
      }
      throw error;
    }
  });

  return result;
};
