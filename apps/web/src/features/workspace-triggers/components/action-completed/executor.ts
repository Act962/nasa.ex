import { NodeExecutor } from "@/features/workspace-executions/types";
import { NonRetriableError } from "inngest";
import { actionContext } from "@/features/workspace-executions/schemas";
import { loadActionContext } from "@/features/workspace-executions/lib/load-action-context";

export const wsActionCompletedExecutor: NodeExecutor = async ({
  context,
  step,
}) => {
  return step.run("ws-action-completed-trigger", async () => {
    const parsed = actionContext.safeParse((context as any).action);
    if (!parsed.success) {
      throw new NonRetriableError("Invalid action data on context");
    }
    const detail = await loadActionContext(parsed.data.id);
    if (!detail) {
      throw new NonRetriableError("Action not found");
    }
    if (!detail.isDone) {
      throw new NonRetriableError("Action is not completed");
    }
    return { ...context, action: { id: parsed.data.id }, realTime: false };
  });
};
