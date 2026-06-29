import { NodeExecutor } from "@/features/workspace-executions/types";
import { NonRetriableError } from "inngest";
import { wsManualTriggerChannel } from "@/inngest/channels/workspace";
import { loadActionContext } from "@/features/workspace-executions/lib/load-action-context";

type ManualTriggerData = {
  action?: { actionId?: string };
};

export const wsManualTriggerExecutor: NodeExecutor<ManualTriggerData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  await publish(
    wsManualTriggerChannel().status({ nodeId, status: "loading" }),
  );

  const result = await step.run("ws-manual-trigger", async () => {
    const actionId = data.action?.actionId || (context.action as any)?.id;
    if (!actionId) {
      throw new NonRetriableError("actionId is required");
    }
    const action = await loadActionContext(actionId);
    if (!action) throw new NonRetriableError("Action not found");
    return { ...context, action: { id: action.id }, realTime: true };
  });

  await publish(
    wsManualTriggerChannel().status({ nodeId, status: "success" }),
  );

  return result;
};
