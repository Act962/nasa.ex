"use client";

import { useOrgRole } from "@/hooks/use-org-role";
import { useCheckPermission } from "@/hooks/use-check-permission";

export function useCanEditLayout(): boolean {
  const { isMaster, isModerador, isAdmin } = useOrgRole();
  const { checkPermission } = useCheckPermission();

  if (isMaster || isModerador) return true;
  if (isAdmin && checkPermission("insights-layout", "canEdit")) return true;
  return false;
}
