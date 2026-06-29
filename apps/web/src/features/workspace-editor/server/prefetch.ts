import { orpc } from "@/lib/orpc";
import { type QueryClient } from "@tanstack/react-query";

export function prefetchWorkspaceWorkflows(
  queryClient: QueryClient,
  workspaceId: string,
) {
  return queryClient.prefetchQuery(
    orpc.workspaceWorkflow.list.queryOptions({ input: { workspaceId } }),
  );
}

export function prefetchWorkspaceWorkflow(
  queryClient: QueryClient,
  workflowId: string,
) {
  return queryClient.prefetchQuery(
    orpc.workspaceWorkflow.getOne.queryOptions({ input: { workflowId } }),
  );
}
