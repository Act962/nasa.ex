"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useCompanyProfile({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ ...orpc.orgs.getCompanyProfile.queryOptions(), enabled });
}
