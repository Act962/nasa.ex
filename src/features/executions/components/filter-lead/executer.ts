import { NodeExecutor } from "@/features/executions/types";
import { FilterLeadFormValues } from "./dialog";

type FilterLeadNodeData = {
  action?: FilterLeadFormValues;
};

export const filterLeadExecutor: NodeExecutor<FilterLeadNodeData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  const result = await step.run("filter-lead", async () => {
    return context;
  });

  return result;
};
