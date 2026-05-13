import { createWorkflow } from "./create";
import { deleteWorkflow } from "./delete";
import { executeWorkflow } from "./execute";
import { getWorkflow } from "./get";
import { listWorkflows } from "./list";
import { updateIsActive } from "./update-is-active";
import { updateName, updateNodes } from "./update";

export const workflowRoutes = {
  create: createWorkflow,
  list: listWorkflows,
  delete: deleteWorkflow,
  getOne: getWorkflow,
  update: {
    updateName,
    updateNodes,
    updateIsActive,
  },
  execute: executeWorkflow,
};
