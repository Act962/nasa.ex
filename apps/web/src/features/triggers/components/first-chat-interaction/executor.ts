import { NodeExecutor } from "@/features/tracking-executions/types";
import { leadContext } from "@/features/tracking-executions/schemas";
import { NonRetriableError } from "inngest";

type FirstChatInteractionTriggerData = Record<string, unknown>;

export const firstChatInteractionTriggerExecutor: NodeExecutor<
  FirstChatInteractionTriggerData
> = async ({ context, step }) => {
  const result = await step.run("first-chat-interaction-trigger", async () => {
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
