import { createWorkflow } from "./create";
import { executeWorkflow } from "./execute";
import { getWorkflow } from "./get";
import { listWorkflows } from "./list";
import { updateName, updateNodes } from "./update";

export const workflowRoutes = {
  create: createWorkflow,
  list: listWorkflows,
  getOne: getWorkflow,
  update: {
    updateName,
    updateNodes,
  },
  execute: executeWorkflow,
};
