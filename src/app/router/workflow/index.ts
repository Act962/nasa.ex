import { createWorkflow } from "./create";
import { getWorkflow } from "./get";
import { listWorkflows } from "./list";

export const workflowRoutes = {
  create: createWorkflow,
  list: listWorkflows,
  getOne: getWorkflow,
};
