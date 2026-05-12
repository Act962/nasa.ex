import { createWorkspaceWorkflow } from "./create";
import { deleteWorkspaceWorkflow } from "./delete";
import { executeWorkspaceWorkflowRoute } from "./execute";
import { getWorkspaceWorkflow } from "./get";
import { listWorkspaceWorkflows } from "./list";
import {
  updateWorkspaceWorkflowName,
  updateWorkspaceWorkflowNodes,
} from "./update";
import { updateWorkspaceWorkflowIsActive } from "./update-is-active";

export const workspaceWorkflowRoutes = {
  create: createWorkspaceWorkflow,
  list: listWorkspaceWorkflows,
  delete: deleteWorkspaceWorkflow,
  getOne: getWorkspaceWorkflow,
  update: {
    updateName: updateWorkspaceWorkflowName,
    updateNodes: updateWorkspaceWorkflowNodes,
    updateIsActive: updateWorkspaceWorkflowIsActive,
  },
  execute: executeWorkspaceWorkflowRoute,
};
