"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export type NerpDashboardRange = "7d" | "30d" | "90d" | "365d";

export function useNerpDashboard(input?: {
  range?: NerpDashboardRange;
  fromDate?: string;
  toDate?: string;
}) {
  return useQuery(orpc.nerp.dashboard.get.queryOptions({ input: input ?? {} }));
}
