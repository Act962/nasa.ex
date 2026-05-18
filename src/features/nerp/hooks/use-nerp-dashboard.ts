"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

// `dashboard.list` no nerp não aceita filtros — agrega sobre hoje/ontem/mês
// passado direto do banco. Sem range customizado.
export function useNerpDashboard() {
  return useQuery(orpc.nerp.dashboard.get.queryOptions({ input: {} }));
}
