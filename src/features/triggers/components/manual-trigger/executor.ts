import { NodeExecutor } from "@/features/executions/types";
import { ManualTriggerFormValues } from "./dialog";
import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";
import { manualTriggerChannel } from "@/inngest/channels/manual-trigger";

type ManualTriggerData = {
  action?: ManualTriggerFormValues;
};

export const manualTriggerExecutor: NodeExecutor<ManualTriggerData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  // TODO: Publish "loading" state for manual trigger
  await publish(
    manualTriggerChannel().status({
      nodeId,
      status: "loading",
    }),
  );

  const result = await step.run("manual-trigger", async () => {
    const leadId = data.action?.leadId;

    if (!leadId) {
      await publish(
        manualTriggerChannel().status({
          nodeId,
          status: "error",
        }),
      );
      throw new NonRetriableError("Lead ID is required");
    }

    const lead = await prisma.lead.findUnique({
      where: {
        id: leadId,
      },
    });

    if (!lead) {
      await publish(
        manualTriggerChannel().status({
          nodeId,
          status: "error",
        }),
      );
      throw new NonRetriableError("Lead not found");
    }

    return {
      ...context,
      lead,
      realTime: true,
    };
  });

  await publish(
    manualTriggerChannel().status({
      nodeId,
      status: "success",
    }),
  );

  return result;
};
