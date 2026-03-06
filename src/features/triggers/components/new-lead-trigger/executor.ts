import { NodeExecutor } from "@/features/executions/types";
import { leadContext } from "@/features/executions/schemas";
import { NonRetriableError } from "inngest";

type NewLeadTriggerData = Record<string, unknown>;

export const newLeadTriggerExecutor: NodeExecutor<NewLeadTriggerData> = async ({
  nodeId,
  context,
  step,
}) => {
  const result = await step.run("new-lead-trigger", async () => {
    const lead = context.lead;

    const parsedLead = leadContext.safeParse(lead);

    if (!parsedLead.success) {
      throw new NonRetriableError("Invalid lead data");
    }

    return {
      ...context,
      lead: parsedLead.data,
      realTime: false,
    };
  });

  return result;
};
