import { NodeExecutor } from "@/features/executions/types";
import { NonRetriableError } from "inngest";
import { WaitFormValues } from "./dialog";
import { waitChannel } from "@/inngest/channels/wait";

type WaitNodeData = {
  action?: WaitFormValues;
};

export const waitExecutor: NodeExecutor<WaitNodeData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  await publish(
    waitChannel().status({
      nodeId,
      status: "loading",
    }),
  );

  const waitTime =
    data.action?.type === "MINUTES"
      ? data.action.minutes + "m"
      : data.action?.type === "HOURS"
        ? data.action.hours + "h"
        : data.action?.days + "d";

  if (!waitTime) {
    await publish(
      waitChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("Wait time is not defined");
  }

  await step.sleep("wait", waitTime);

  await publish(
    waitChannel().status({
      nodeId,
      status: "success",
    }),
  );

  return context;
};
