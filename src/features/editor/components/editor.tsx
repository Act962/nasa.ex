"use client";

import { orpc } from "@/lib/orpc";
import { useSuspenseQuery } from "@tanstack/react-query";

export function Editor({ workflowId }: { workflowId: string }) {
  const { data, isPending } = useSuspenseQuery(
    orpc.workflow.getOne.queryOptions({
      input: {
        workflowId,
      },
    })
  );

  if (isPending) {
    return <div>Loading...</div>;
  }

  return <div>{JSON.stringify(data, null, 2)}</div>;
}
