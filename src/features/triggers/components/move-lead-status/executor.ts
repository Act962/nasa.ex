import { NodeExecutor } from "@/features/executions/types";
import { leadContext } from "@/features/executions/schemas";
import { NonRetriableError } from "inngest";

type MoveLeadStatusTriggerData = Record<string, unknown>;

export const moveLeadStatusTriggerExecutor: NodeExecutor<
  MoveLeadStatusTriggerData
> = async ({ nodeId, context, step }) => {
  const result = await step.run("move-lead-status-trigger", async () => {
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
