import { createWorkflow } from "./create";
import { getWorkflow } from "./get";
import { listWorkflows } from "./list";
import { updateName } from "./update";

export const workflowRoutes = {
  create: createWorkflow,
  list: listWorkflows,
  getOne: getWorkflow,
  update: {
    updateName,
  },
};
