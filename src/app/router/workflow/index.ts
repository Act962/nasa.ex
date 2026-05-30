import { createWorkflow } from "./create";
import { deleteWorkflow } from "./delete";
import { executeWorkflow } from "./execute";
import { getWorkflow } from "./get";
import { listWorkflows } from "./list";
import { updateIsActive } from "./update-is-active";
import { updateName, updateNodes } from "./update";
import { updateAgentMode } from "./update-agent-mode";
import { dryRunWorkflow } from "./dry-run";
import { listWorkflowRuns, getWorkflowRunDetail } from "./list-runs";
import { validateWorkflowProc } from "./validate";
import { stepNodeProc } from "./step-node";

export const workflowRoutes = {
  create: createWorkflow,
  list: listWorkflows,
  delete: deleteWorkflow,
  getOne: getWorkflow,
  update: {
    updateName,
    updateNodes,
    updateIsActive,
    updateAgentMode,
  },
  execute: executeWorkflow,
  dryRun: dryRunWorkflow,
  validate: validateWorkflowProc,
  stepNode: stepNodeProc,
  listRuns: listWorkflowRuns,
  getRun: getWorkflowRunDetail,
};
