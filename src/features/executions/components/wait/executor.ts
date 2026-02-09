import { NodeExecutor } from "@/features/executions/types";
import { NonRetriableError } from "inngest";
import { WaitFormValues } from "./dialog";

type WaitNodeData = {
  action?: WaitFormValues;
};

export const waitExecutor: NodeExecutor<WaitNodeData> = async ({
  data,
  nodeId,
  context,
  step,
}) => {
  const waitTime =
    data.action?.type === "MINUTES"
      ? data.action.minutes + "m"
      : data.action?.type === "HOURS"
        ? data.action.hours + "h"
        : data.action?.days + "d";

  if (!waitTime) {
    throw new NonRetriableError("Wait time is not defined");
  }

  await step.sleep("wait", waitTime);

  return context;
};
