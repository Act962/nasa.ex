"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useNerpOrg() {
  return useQuery(orpc.nerp.org.get.queryOptions({ input: {} }));
}
