import { NodeExecutor } from "@/features/executions/types";
import { leadContext } from "@/features/executions/schemas";
import { NonRetriableError } from "inngest";
import { MoveLeadStatusTriggerFormValues } from "./dialog";

type MoveLeadStatusTriggerData = {
  action?: MoveLeadStatusTriggerFormValues;
};

export const moveLeadStatusTriggerExecutor: NodeExecutor<
  MoveLeadStatusTriggerData
> = async ({ nodeId, context, step, data }) => {
  const result = await step.run("move-lead-status-trigger", async () => {
    const lead = context.lead;
    const previousLead = context.previousLead;

    const parsedLead = leadContext.safeParse(lead);
    const parsedPreviousLead = leadContext.safeParse(previousLead);

    if (!parsedLead.success || !parsedPreviousLead.success) {
      throw new NonRetriableError("Invalid lead data");
    }

    if (data.action?.statusId === parsedPreviousLead.data.statusId) {
      throw new NonRetriableError("Status not changed");
    }

    return {
      ...context,
      lead: parsedLead.data,
      realTime: false,
    };
  });

  return result;
};
