import { NodeExecutor } from "@/features/tracking-executions/types";
import { LeadContext } from "../../schemas";
import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";
import { moveLeadChannel } from "@/inngest/channels/move-lead";
import { TemperatureFormValues } from "./dialog";
import { temperatureChannel } from "@/inngest/channels/temperature";
import { publishLeadChanged } from "@/features/leads/realtime/publish";

type TemperatureNodeData = {
  action?: TemperatureFormValues;
};

export const temperatureExecutor: NodeExecutor<TemperatureNodeData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  const lead = context.lead as LeadContext;
  const realTime = context.realTime as boolean;
  const result = await step.run("temperature", async () => {
    if (realTime) {
      await publish(
        temperatureChannel().status({
          nodeId,
          status: "loading",
        }),
      );
    }
    if (!data.action?.temperature) {
      if (realTime) {
        await publish(
          temperatureChannel().status({
            nodeId,
            status: "error",
          }),
        );
      }
      throw new NonRetriableError("Temperature not found");
    }

    const updatedLead = await prisma.lead.update({
      where: {
        id: lead.id,
      },
      data: {
        temperature: data.action.temperature,
      },
    });

    await publishLeadChanged({
      leadId: lead.id,
      trackingId: lead.trackingId,
      statusId: lead.statusId,
      fields: ["temperature"],
    });

    if (realTime) {
      await publish(
        temperatureChannel().status({
          nodeId,
          status: "success",
        }),
      );
    }
    return {
      ...context,
      lead: updatedLead,
    };
  });

  return result;
};
