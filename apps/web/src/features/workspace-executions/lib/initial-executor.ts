import { NodeExecutor } from "@/features/workspace-executions/types";

export const wsInitialExecutor: NodeExecutor = async ({ context, step }) => {
  return step.run("ws-initial", async () => context);
};
