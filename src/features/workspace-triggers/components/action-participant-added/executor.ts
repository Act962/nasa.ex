import { NodeExecutor } from "@/features/workspace-executions/types";
import { NonRetriableError } from "inngest";
import { actionContext } from "@/features/workspace-executions/schemas";
import { loadActionContext } from "@/features/workspace-executions/lib/load-action-context";

type Data = {
  action?: { userId?: string };
};

export const wsActionParticipantAddedExecutor: NodeExecutor<Data> = async ({
  data,
  context,
  step,
}) => {
  return step.run("ws-action-participant-added-trigger", async () => {
    const parsed = actionContext.safeParse((context as any).action);
    if (!parsed.success) {
      throw new NonRetriableError("Invalid action data on context");
    }
    const expectedUserId = data.action?.userId;
    if (expectedUserId) {
      const detail = await loadActionContext(parsed.data.id);
      if (!detail) {
        throw new NonRetriableError("Action not found");
      }
      if (!detail.participantIds.includes(expectedUserId)) {
        throw new NonRetriableError(
          "Participant does not match trigger config",
        );
      }
    }
    return { ...context, action: { id: parsed.data.id }, realTime: false };
  });
};
