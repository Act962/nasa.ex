import { exportWorkflow } from "./export-workflow";
import { exportNodes } from "./export-nodes";
import { previewImport } from "./preview-import";
import { importWorkflow } from "./import-workflow";

/**
 * Procedures de copy/paste/export/import de workflow.
 * Acessadas via `orpc.workflowClipboard.*`.
 */
export const workflowClipboardRouter = {
  exportWorkflow,
  exportNodes,
  previewImport,
  importWorkflow,
};
