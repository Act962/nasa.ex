import { NodeExecutor } from "@/features/executions/types";
import { LeadContext } from "../../schemas";
import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";
import { moveLeadChannel } from "@/inngest/channels/move-lead";
import { TemperatureFormValues } from "./dialog";

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
    if (!data.action?.temperature) {
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

    return {
      ...context,
      lead: updatedLead,
    };
  });

  return result;
};
