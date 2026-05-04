"use client";

import { orpc } from "@/lib/orpc";
import { useOrgRole } from "./use-org-role";
import { useQuery } from "@tanstack/react-query";

type AppKey =
  | "tracking"
  | "chat"
  | "forge"
  | "spacetime"
  | "nasa-planner"
  | "insights"
  | "insights-layout"
  | "integrations"
  | "explorer"
  | "nbox"
  | "forge-contracts";

type PermissionAction = "canView" | "canCreate" | "canEdit" | "canDelete";

export function useCheckPermission() {
  const { role, isMaster } = useOrgRole();
  
  const { data } = useQuery({
    ...orpc.permissions.getPermissions.queryOptions(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const checkPermission = (appKey: AppKey, action: PermissionAction = "canView"): boolean => {
    // Master has all permissions
    if (isMaster) return true;
    if (!role || !data?.matrix) return false;

    const rolePerms = data.matrix[role];
    if (!rolePerms) return false;

    const appPerms = rolePerms[appKey];
    if (!appPerms) return false;

    return !!appPerms[action];
  };

  return { checkPermission, isLoading: !data && !!role };
}
