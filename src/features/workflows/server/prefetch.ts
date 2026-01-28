import { router } from "@/app/router";
import { orpc } from "@/lib/orpc";
import type { InferRouterInputs } from "@orpc/server";
import { type QueryClient } from "@tanstack/react-query";

type Input = InferRouterInputs<typeof router.workflow.list>;

export function prefetchWorkflows(queryClient: QueryClient, params: Input) {
  return queryClient.prefetchQuery(
    orpc.workflow.list.queryOptions({
      input: params,
    }),
  );
}

export function prefetchWorkflow(queryClient: QueryClient, workflowId: string) {
  return queryClient.prefetchQuery(
    orpc.workflow.getOne.queryOptions({
      input: {
        workflowId,
      },
    }),
  );
}
