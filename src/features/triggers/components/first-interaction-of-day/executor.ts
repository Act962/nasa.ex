import { NodeExecutor } from "@/features/tracking-executions/types";
import { leadContext } from "@/features/tracking-executions/schemas";
import { NonRetriableError } from "inngest";

type FirstInteractionOfDayTriggerData = Record<string, unknown>;

export const firstInteractionOfDayTriggerExecutor: NodeExecutor<
  FirstInteractionOfDayTriggerData
> = async ({ context, step }) => {
  const result = await step.run("first-interaction-of-day-trigger", async () => {
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
