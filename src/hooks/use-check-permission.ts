"use client";

import { orpc } from "@/lib/orpc";
import { useOrgRole } from "./use-org-role";
import { useQuery } from "@tanstack/react-query";
import type { PermissionAction } from "@/features/permissions/lib/app-permission-catalog";
import { SIDEBAR_PERMISSION_APP } from "@/features/permissions/lib/sidebar-permission-app";

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

    // Exceção da própria pessoa vence a do papel (spec 0152).
    const appPerms = data.myOverrides?.[appKey] ?? data.matrix[role]?.[appKey];
    if (!appPerms) return false;

    return !!appPerms[action as keyof typeof appPerms];
  };

  /**
   * Item do menu lateral escondido por "Ver" desligado (spec 0152, RF-5). Enquanto carrega, nada some:
   * esconder tudo por um instante faria o menu piscar.
   */
  const isSidebarItemHidden = (sidebarKey: string): boolean => {
    const appKey = SIDEBAR_PERMISSION_APP[sidebarKey];
    if (!appKey || isMaster || !role || !data?.matrix) return false;
    return !checkPermission(appKey, "canView");
  };

  return { checkPermission, isSidebarItemHidden, isLoading: !data && !!role };
}
