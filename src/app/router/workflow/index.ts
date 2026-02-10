import { createWorkflow } from "./create";
import { deleteWorkflow } from "./delete";
import { executeWorkflow } from "./execute";
import { getWorkflow } from "./get";
import { listWorkflows } from "./list";
import { updateName, updateNodes } from "./update";

export const workflowRoutes = {
  create: createWorkflow,
  list: listWorkflows,
  delete: deleteWorkflow,
  getOne: getWorkflow,
  update: {
    updateName,
    updateNodes,
  },
  execute: executeWorkflow,
};
