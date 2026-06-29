"use client";

import { authClient } from "@/lib/auth-client";

/**
 * Returns the current user's role in the active organization.
 *
 * Roles:
 *  - "owner"     → Master  (full access)
 *  - "admin"     → Adm     (intermediate)
 *  - "member"    → Single  (restricted)
 *  - "moderador" → Moderador (manages users)
 */
export function useOrgRole() {
  const { data: session } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();

  const role: string | null =
    (activeOrg?.members as any[])?.find(
      (m: any) => m.userId === session?.user?.id,
    )?.role ?? null;

  const isSingle    = role === "member";
  const isMaster    = role === "owner";
  const isAdmin     = role === "admin";
  const isModerador = role === "moderador";
  const canManage   = isMaster || isModerador;

  return { role, isSingle, isMaster, isAdmin, isModerador, canManage };
}
