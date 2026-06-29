"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";

export function useAdminOrgUsers(orgId: string | null, page: number) {
  return useQuery({
    ...orpc.spacePoint.adminOrgUsers.queryOptions({ input: { orgId: orgId ?? "", page, limit: 20 } }),
    queryKey: ["admin", "spacePoints", "orgUsers", orgId, page],
    enabled: !!orgId,
    staleTime: 30_000,
  });
}

export function useAdminOrgRules(orgId: string | null) {
  return useQuery({
    ...orpc.spacePoint.adminOrgRules.queryOptions({ input: { orgId: orgId ?? "" } }),
    queryKey: ["admin", "spacePoints", "orgRules", orgId],
    enabled: !!orgId,
    staleTime: 30_000,
  });
}

export function useAdminAdjust() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userId: string; orgId: string; points: number; description: string }) =>
      orpc.spacePoint.adminAdjust.call(vars),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "spacePoints", "orgUsers", vars.orgId] });
      toast.success("Pontos ajustados!");
    },
    onError: () => toast.error("Erro ao ajustar pontos"),
  });
}

export function useAdminCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { orgId: string; action: string; label: string; points: number; cooldownHours?: number | null; popupTemplateId?: string | null }) =>
      orpc.spacePoint.adminCreateRule.call(vars),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "spacePoints", "orgRules", vars.orgId] });
      toast.success("Regra criada!");
    },
    onError: () => toast.error("Erro ao criar regra"),
  });
}

export function useAdminUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; orgId: string; points?: number; isActive?: boolean; label?: string; cooldownHours?: number | null; popupTemplateId?: string | null }) =>
      orpc.spacePoint.adminUpdateRule.call({ id: vars.id, points: vars.points, isActive: vars.isActive, label: vars.label, cooldownHours: vars.cooldownHours, popupTemplateId: vars.popupTemplateId }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "spacePoints", "orgRules", vars.orgId] });
    },
  });
}

export function usePopupTemplates() {
  return useQuery({
    queryKey: ["admin", "popupTemplates"],
    queryFn: async () => {
      const res = await fetch("/api/admin/popup-templates");
      const data = await res.json();
      return (data as { id: string; name: string }[]) ?? [];
    },
    staleTime: 60_000,
  });
}
