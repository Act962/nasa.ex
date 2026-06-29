import { InferUITools, UIDataTypes, UIMessage } from "ai";
import { createLeadTool } from "./tools/create-lead";
import { findLeadsTool } from "./tools/find-leads";
import { updateLeadTool } from "./tools/update-lead";
import { moveLeadToStatusTool } from "./tools/move-lead-to-status";
import { listStatusesTool } from "./tools/list-statuses";
import { listWorkflowsTool } from "./tools/list-workflows";
import { createWorkflowTool } from "./tools/create-workflow";
import { addNodeTool } from "./tools/add-node";
import { connectNodesTool } from "./tools/connect-nodes";
import { executeWorkflowTool } from "./tools/execute-workflow";
import { getWorkflowTool } from "./tools/get-workflow";

const _tools = {
  listStatuses: listStatusesTool(""),
  createLead: createLeadTool("", ""),
  findLeads: findLeadsTool(""),
  updateLead: updateLeadTool(""),
  moveLeadToStatus: moveLeadToStatusTool(""),
  listWorkflows: listWorkflowsTool(""),
  createWorkflow: createWorkflowTool("", ""),
  addNode: addNodeTool(),
  connectNodes: connectNodesTool(),
  executeWorkflow: executeWorkflowTool(""),
  getWorkflow: getWorkflowTool(),
};

export type AiTrackingTools = InferUITools<typeof _tools>;
export type AiTrackingMessage = UIMessage<never, UIDataTypes, AiTrackingTools>;
