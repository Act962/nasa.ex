import { NodeExecutor } from "@/features/workspace-executions/types";
import { NonRetriableError } from "inngest";
import { actionContext } from "@/features/workspace-executions/schemas";

export const wsActionCreatedExecutor: NodeExecutor = async ({
  context,
  step,
}) => {
  return step.run("ws-action-created-trigger", async () => {
    const parsed = actionContext.safeParse((context as any).action);
    if (!parsed.success) {
      throw new NonRetriableError("Invalid action data on context");
    }
    return { ...context, action: { id: parsed.data.id }, realTime: false };
  });
};
