"use client";

import { orpc } from "@/lib/orpc";
import { useOrgRole } from "./use-org-role";
import { useQuery } from "@tanstack/react-query";
import type { PermissionAction } from "@/features/permissions/lib/app-permission-catalog";

// Chaves do catálogo em features/permissions/lib/app-permission-catalog.ts.
// Actions estendidas (`canApprove`, `canPay`) só valem para os apps de
// EXTENDED_ACTIONS_BY_APP (financeiro, star-friends).
type AppKey = string;

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

    return !!appPerms[action as keyof typeof appPerms];
  };

  return { checkPermission, isLoading: !data && !!role };
}
