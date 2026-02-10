import { NodeExecutor } from "@/features/executions/types";
import { ManualTriggerFormValues } from "./dialog";
import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";

type ManualTriggerData = {
  action?: ManualTriggerFormValues;
};

export const manualTriggerExecutor: NodeExecutor<ManualTriggerData> = async ({
  data,
  nodeId,
  context,
  step,
}) => {
  // TODO: Publish "loading" state for manual trigger
  const result = await step.run("manual-trigger", async () => {
    const leadId = data.action?.leadId;

    if (!leadId) {
      throw new NonRetriableError("Lead ID is required");
    }

    const lead = await prisma.lead.findUnique({
      where: {
        id: leadId,
      },
    });

    if (!lead) {
      throw new NonRetriableError("Lead not found");
    }

    return {
      ...context,
      lead,
    };
  });

  return result;
};
