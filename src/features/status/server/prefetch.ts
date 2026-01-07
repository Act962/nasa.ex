import { router } from "@/app/router";
import { orpc } from "@/lib/orpc";
import type { InferRouterInputs } from "@orpc/server";
import { type QueryClient } from "@tanstack/react-query";

type Input = InferRouterInputs<typeof router.status.list>;

export function prefetchStatus(queryClient: QueryClient, params: Input) {
  return queryClient.prefetchQuery(
    orpc.status.list.queryOptions({
      input: params,
    })
  );
}
