import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";

/**
 * Hooks oRPC do workflow-clipboard. Mutations puras — sem invalidate
 * default (caller decide o que recarregar via callback `onSuccess`).
 */

export function useExportWorkflow() {
  return useMutation(orpc.workflowClipboard.exportWorkflow.mutationOptions());
}

export function useExportNodes() {
  return useMutation(orpc.workflowClipboard.exportNodes.mutationOptions());
}

export function usePreviewImport() {
  return useMutation(orpc.workflowClipboard.previewImport.mutationOptions());
}

export function useImportWorkflow() {
  return useMutation(orpc.workflowClipboard.importWorkflow.mutationOptions());
}
