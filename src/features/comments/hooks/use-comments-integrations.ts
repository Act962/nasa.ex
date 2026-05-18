"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useCommentsIntegrations() {
  return useQuery(
    orpc.commentsApp.integration.getIntegrations.queryOptions({ input: {} }),
  );
}
