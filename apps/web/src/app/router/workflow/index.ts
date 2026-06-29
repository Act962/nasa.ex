import { createWorkflow } from "./create";
import { createWorkflowFromBlueprintProc } from "./create-from-blueprint";
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
  /**
   * Cria workflow inteiro (nodes + edges + tags) em batch a partir de
   * blueprint estruturado. Usado pela tool IA `generate_workflow_from_intent`.
   */
  createFromBlueprint: createWorkflowFromBlueprintProc,
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
